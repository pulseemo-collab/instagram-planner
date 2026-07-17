"use client";

import { getRepository } from "@/lib/repositories";
import type { Repository, WorkspaceSnapshot } from "@/lib/repositories/types";

export type StoreStatus = "idle" | "loading" | "ready" | "error";

export interface WorkspaceState {
  status: StoreStatus;
  error: string | null;
  mode: "demo" | "supabase";
  snapshot: WorkspaceSnapshot | null;
}

type Listener = () => void;

/**
 * Tiny external store bridging the repository to React via
 * useSyncExternalStore. After every mutation the snapshot is reloaded from
 * the repository, so all pages stay consistent regardless of backend.
 */
class WorkspaceStore {
  private state: WorkspaceState = { status: "idle", error: null, mode: "demo", snapshot: null };
  private listeners = new Set<Listener>();
  private loadPromise: Promise<void> | null = null;

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

  async refresh(initial = false): Promise<void> {
    if (initial) this.setState({ status: "loading", error: null });
    try {
      const repo = await getRepository();
      const snapshot = await repo.loadSnapshot();
      await resolveLocalMedia(repo, snapshot);
      this.setState({ status: "ready", snapshot, mode: repo.mode, error: null });
    } catch (error) {
      this.setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load workspace",
      });
    }
  }

  /** Run a mutation then refresh the snapshot. */
  async mutate<T>(fn: (repo: Repository) => Promise<T>): Promise<T> {
    const repo = await getRepository();
    const result = await fn(repo);
    await this.refresh();
    return result;
  }

  async reset(): Promise<void> {
    this.loadPromise = null;
    this.state = { status: "idle", error: null, mode: this.state.mode, snapshot: null };
  }
}

/**
 * Replace demo-mode `local:` references with displayable data URLs so UI
 * components never need to resolve media themselves.
 */
async function resolveLocalMedia(
  repo: Repository,
  snapshot: WorkspaceSnapshot,
): Promise<void> {
  const resolve = async (url: string | null): Promise<string | null> =>
    url && url.startsWith("local:") ? repo.resolveMediaUrl(url) : url;

  await Promise.all([
    ...snapshot.clients.map(async (client) => {
      client.avatarUrl = await resolve(client.avatarUrl);
    }),
    ...snapshot.highlights.map(async (highlight) => {
      highlight.coverUrl = await resolve(highlight.coverUrl);
    }),
    ...snapshot.media.map(async (media) => {
      media.url = (await resolve(media.url)) ?? media.url;
      media.thumbnailUrl = await resolve(media.thumbnailUrl);
    }),
  ]);
}

export const workspaceStore = new WorkspaceStore();

