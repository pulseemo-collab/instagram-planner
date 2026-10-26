"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/toast";
import type { Repository } from "@/lib/repositories/types";
import { workspaceStore, type SnapshotPatch, type WorkspaceState } from "./workspace-store";

export function useWorkspace(): WorkspaceState {
  const state = useSyncExternalStore(
    workspaceStore.subscribe,
    workspaceStore.getState,
    workspaceStore.getState,
  );
  useEffect(() => {
    void workspaceStore.ensureLoaded();
  }, []);
  return state;
}

/**
 * Stable mutation runner: awaits the repo call, then refreshes the snapshot.
 * Throws on failure — use it where the caller shows the error itself (forms
 * with an inline error message). Everywhere else, use `useAction`.
 */
export function useMutate(): <T>(
  fn: (repo: Repository) => Promise<T>,
  patch?: SnapshotPatch<T>,
) => Promise<T> {
  return useCallback(
    <T,>(fn: (repo: Repository) => Promise<T>, patch?: SnapshotPatch<T>) =>
      workspaceStore.mutate(fn, patch),
    [],
  );
}

export type ActionResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Mutation runner for buttons and other fire-and-forget actions: on failure
 * it shows an error toast and resolves `{ ok: false }` — it never throws, so
 * nothing goes unhandled. Run success feedback only when `ok` is true.
 * With `patch`, the snapshot is updated locally once the backend call has
 * succeeded (see ./patches.ts); a failed call leaves the snapshot untouched.
 */
export function useAction(): <T>(
  fn: (repo: Repository) => Promise<T>,
  patch?: SnapshotPatch<T>,
) => Promise<ActionResult<T>> {
  const { toast } = useToast();
  return useCallback(
    async <T,>(
      fn: (repo: Repository) => Promise<T>,
      patch?: SnapshotPatch<T>,
    ): Promise<ActionResult<T>> => {
      try {
        return { ok: true, value: await workspaceStore.mutate(fn, patch) };
      } catch (error) {
        const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
        toast(`Couldn't save your changes${detail}. Please try again.`, "error");
        return { ok: false };
      }
    },
    [toast],
  );
}
