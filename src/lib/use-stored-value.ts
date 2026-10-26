"use client";

import { useCallback, useSyncExternalStore } from "react";

type StorageKind = "local" | "session";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Other tabs' localStorage writes.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function storageFor(kind: StorageKind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // blocked (privacy mode / sandboxed iframe)
  }
}

/**
 * A browser-storage string, read without a hydration mismatch: the server
 * render and the hydrating client render both see `null`, then React
 * re-renders with the stored value (useSyncExternalStore's server snapshot).
 * `set` writes (null removes) and updates every component using the key.
 */
export function useStoredValue(
  key: string,
  kind: StorageKind = "local",
): [string | null, (value: string | null) => void] {
  const read = useCallback(() => {
    try {
      return storageFor(kind)?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }, [key, kind]);

  const value = useSyncExternalStore(subscribe, read, () => null);

  const set = useCallback(
    (next: string | null) => {
      try {
        const storage = storageFor(kind);
        if (next === null) storage?.removeItem(key);
        else storage?.setItem(key, next);
      } catch {
        // storage full or blocked — the value just isn't remembered
      }
      for (const listener of listeners) listener();
    },
    [key, kind],
  );

  return [value, set];
}
