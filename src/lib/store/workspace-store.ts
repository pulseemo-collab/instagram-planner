"use client";

import { resolveMediaRefs } from "@/lib/media/resolve-media";
import { getRepository } from "@/lib/repositories";
import type { Repository, WorkspaceSnapshot } from "@/lib/repositories/types";

export type StoreStatus = "idle" | "loading" | "ready" | "error";

export interface WorkspaceState {
  status: StoreStatus;
  error: string | null;
  mode: "demo" | "supabase";
  snapshot: WorkspaceSnapshot | null;
}

/**
 * Applies a mutation's result to the current snapshot without a reload.
 * Only for mutations whose result FULLY describes the change (see
 * ./patches.ts); must return a new object and never mutate its input.
 */
export type SnapshotPatch<T> = (snapshot: WorkspaceSnapshot, result: T) => WorkspaceSnapshot;

interface LoadedWorkspace {
  snapshot: WorkspaceSnapshot;
  mode: "demo" | "supabase";
}

export interface WorkspaceStoreDeps {
  /** Loads a fresh, display-ready snapshot (injectable for tests). */
  load?: () => Promise<LoadedWorkspace>;
  repository?: () => Promise<Repository>;
}

type Listener = () => void;

async function loadFromRepository(): Promise<LoadedWorkspace> {
  const repo = await getRepository();
  const snapshot = await repo.loadSnapshot();
  await resolveMediaRefs(repo, snapshot);
  return { snapshot, mode: repo.mode };
}

/**
 * Tiny external store bridging the repository to React via
 * useSyncExternalStore.
 *
 * Ordering: every refresh and every local patch takes a sequence number.
 * A finished refresh is applied only if nothing newer has been applied since
 * it STARTED — an older snapshot can never overwrite a newer one. A refresh
 * dropped because a patch landed meanwhile is followed by one fresh refresh,
 * so changes from other tabs are superseded, never lost.
 */
export class WorkspaceStore {
  private state: WorkspaceState = { status: "idle", error: null, mode: "demo", snapshot: null };
  private listeners = new Set<Listener>();
  private loadPromise: Promise<void> | null = null;

  private seq = 0;
  /** Sequence number of the newest data now in `state.snapshot`. */
  private appliedSeq = 0;
  private lastPatchSeq = 0;
  private lastRefreshAt = 0;
  private backgroundRefresh: Promise<void> | null = null;
  private backgroundQueued = false;

  private readonly load: () => Promise<LoadedWorkspace>;
  private readonly repository: () => Promise<Repository>;

  constructor(deps: WorkspaceStoreDeps = {}) {
    this.load = deps.load ?? loadFromRepository;
    this.repository = deps.repository ?? getRepository;
  }

  getState = (): WorkspaceState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(patch: Partial<WorkspaceState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.refresh(true);
    return this.loadPromise;
  }

  /**
   * Reload the snapshot. If a workspace was already loaded, a failed refresh
   * keeps showing it (status stays "ready", `error` explains the stale data);
   * only a workspace that never loaded ends in status "error".
   */
  async refresh(initial = false): Promise<void> {
    const startSeq = ++this.seq;
    if (initial) this.setState({ status: "loading", error: null });
    try {
      const { snapshot, mode } = await this.load();
      if (startSeq < this.appliedSeq) {
        // Something newer is already showing. If it's a local patch, re-check
        // once so other tabs' changes from this load still arrive.
        if (this.lastPatchSeq > startSeq) await this.refresh();
        return;
      }
      this.appliedSeq = startSeq;
      this.lastRefreshAt = Date.now();
      this.setState({ status: "ready", snapshot, mode, error: null });
    } catch (error) {
      if (startSeq < this.appliedSeq) return; // superseded — its failure is moot
      const message = error instanceof Error ? error.message : "Failed to load workspace";
      this.setState(
        this.state.snapshot && !initial
          ? { status: "ready", error: message }
          : { status: "error", error: message, snapshot: null },
      );
    }
  }

  /**
   * Refresh for change signals (Realtime events, other tabs): never skipped,
   * but bursts coalesce into at most one refresh in flight plus one queued.
   */
  refreshSoon(): Promise<void> {
    if (this.backgroundRefresh) {
      this.backgroundQueued = true;
      return this.backgroundRefresh;
    }
    this.backgroundRefresh = (async () => {
      try {
        do {
          this.backgroundQueued = false;
          await this.refresh();
        } while (this.backgroundQueued);
      } finally {
        this.backgroundRefresh = null;
      }
    })();
    return this.backgroundRefresh;
  }

  /** Refresh for speculative triggers (window focus): skipped if recent. */
  refreshIfStale(maxAgeMs = 30_000): Promise<void> {
    if (Date.now() - this.lastRefreshAt < maxAgeMs) return Promise.resolve();
    return this.refreshSoon();
  }

  /**
   * Run a mutation, then bring the snapshot up to date: with `patch`, apply
   * the result locally (only once the backend call has succeeded — a failure
   * throws and leaves the snapshot untouched); otherwise reload in full.
   */
  async mutate<T>(fn: (repo: Repository) => Promise<T>, patch?: SnapshotPatch<T>): Promise<T> {
    const repo = await this.repository();
    const result = await fn(repo);
    const current = this.state.snapshot;
    if (patch && current && this.state.status === "ready") {
      let next: WorkspaceSnapshot | null = null;
      try {
        next = patch(current, result);
      } catch {
        next = null; // a patch bug must never corrupt state — reload instead
      }
      if (next) {
        this.lastPatchSeq = this.appliedSeq = ++this.seq;
        this.setState({ snapshot: next });
        return result;
      }
    }
    await this.refresh();
    return result;
  }

  async reset(): Promise<void> {
    this.loadPromise = null;
    this.state = { status: "idle", error: null, mode: this.state.mode, snapshot: null };
  }
}

export const workspaceStore = new WorkspaceStore();
