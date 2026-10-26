import { describe, expect, it, vi } from "vitest";
import type { Repository, WorkspaceSnapshot } from "@/lib/repositories/types";
import { WorkspaceStore, type SnapshotPatch } from "@/lib/store/workspace-store";

/*
 * Workspace store ordering and patch rules, tested without a browser: the
 * store's loader is replaced by one whose loads the test resolves by hand,
 * in any order.
 */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Loaded = { snapshot: WorkspaceSnapshot; mode: "demo" };

/** A minimal snapshot identified by its user's display name. */
function snapshot(label: string): Loaded {
  return {
    snapshot: { user: { displayName: label }, notifications: [] } as unknown as WorkspaceSnapshot,
    mode: "demo",
  };
}

function controlledStore() {
  const loads: Array<Deferred<Loaded>> = [];
  const store = new WorkspaceStore({
    load: () => {
      const load = deferred<Loaded>();
      loads.push(load);
      return load.promise;
    },
    repository: async () => ({}) as Repository,
  });
  const label = () => store.getState().snapshot?.user.displayName;
  async function loadInitial(name = "base") {
    const initial = store.refresh(true);
    loads[loads.length - 1].resolve(snapshot(name));
    await initial;
  }
  return { store, loads, label, loadInitial };
}

const rename =
  (name: string): SnapshotPatch<unknown> =>
  (s) => ({ ...s, user: { ...s.user, displayName: name } });

describe("Workspace store ordering", () => {
  it("an older refresh never overwrites a newer one", async () => {
    const { store, loads, label } = controlledStore();
    const older = store.refresh();
    const newer = store.refresh();
    loads[1].resolve(snapshot("newer"));
    await newer;
    loads[0].resolve(snapshot("older"));
    await older;
    expect(label()).toBe("newer");
  });

  it("a refresh started before a patch can't overwrite it; a follow-up refresh still lands", async () => {
    const { store, loads, label, loadInitial } = controlledStore();
    await loadInitial();

    const inFlight = store.refresh(); // started before the patch
    await store.mutate(async () => "ok", rename("patched"));
    expect(label()).toBe("patched");
    expect(loads).toHaveLength(2); // the patch itself didn't reload

    loads[1].resolve(snapshot("stale"));
    await vi.waitFor(() => expect(loads).toHaveLength(3)); // follow-up refresh requested
    expect(label()).toBe("patched");

    loads[2].resolve(snapshot("fresh"));
    await inFlight;
    expect(label()).toBe("fresh");
  });

  it("a patch is applied only after the backend call succeeds", async () => {
    const { store, loads, label, loadInitial } = controlledStore();
    await loadInitial();

    const backend = deferred<string>();
    const running = store.mutate(() => backend.promise, rename("patched"));
    await Promise.resolve();
    expect(label()).toBe("base"); // nothing applied while the call is pending
    backend.resolve("ok");
    await running;
    expect(label()).toBe("patched");
    expect(loads).toHaveLength(1);
  });

  it("a failed patched mutation leaves the snapshot unchanged and doesn't reload", async () => {
    const { store, loads, label, loadInitial } = controlledStore();
    await loadInitial();
    const before = store.getState().snapshot;

    await expect(
      store.mutate(async () => {
        throw new Error("backend down");
      }, rename("patched")),
    ).rejects.toThrow("backend down");

    expect(store.getState().snapshot).toBe(before);
    expect(label()).toBe("base");
    expect(loads).toHaveLength(1);
  });

  it("a mutation without a patch reloads", async () => {
    const { store, loads, label, loadInitial } = controlledStore();
    await loadInitial();
    const running = store.mutate(async () => "ok");
    await vi.waitFor(() => expect(loads).toHaveLength(2));
    loads[1].resolve(snapshot("reloaded"));
    await running;
    expect(label()).toBe("reloaded");
  });

  it("a burst of change signals causes at most two loads", async () => {
    const { store, loads, loadInitial } = controlledStore();
    await loadInitial();

    const burst = Array.from({ length: 10 }, () => store.refreshSoon());
    expect(loads).toHaveLength(2); // one in flight, the rest coalesced
    loads[1].resolve(snapshot("first"));
    await vi.waitFor(() => expect(loads).toHaveLength(3)); // exactly one queued follow-up
    loads[2].resolve(snapshot("second"));
    await Promise.all(burst);
    expect(loads).toHaveLength(3);
  });

  it("a focus refresh is skipped right after a refresh, and runs once it's stale", async () => {
    const { store, loads, loadInitial } = controlledStore();
    await loadInitial();
    await store.refreshIfStale(30_000);
    expect(loads).toHaveLength(1);

    const stale = store.refreshIfStale(0);
    expect(loads).toHaveLength(2);
    loads[1].resolve(snapshot("later"));
    await stale;
  });
});
