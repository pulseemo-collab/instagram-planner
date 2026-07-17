"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Repository } from "@/lib/repositories/types";
import { workspaceStore, type WorkspaceState } from "./workspace-store";

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

/** Stable mutation runner: awaits the repo call, then refreshes the snapshot. */
export function useMutate(): <T>(fn: (repo: Repository) => Promise<T>) => Promise<T> {
  return useCallback(<T,>(fn: (repo: Repository) => Promise<T>) => workspaceStore.mutate(fn), []);
}
