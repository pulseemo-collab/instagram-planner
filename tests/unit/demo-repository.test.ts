import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceSnapshot } from "@/lib/repositories/types";

/*
 * DemoRepository against an in-memory IndexedDB. Every test gets a fresh
 * database and fresh module instances (the IndexedDB connection is cached
 * per module). Two repository instances from the same import stand in for
 * two browser tabs sharing one database.
 */

type DemoModule = typeof import("@/lib/repositories/demo-repository");
type IdbModule = typeof import("@/lib/idb");

let demo: DemoModule;
let idb: IdbModule;

beforeEach(async () => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  vi.resetModules();
  demo = await import("@/lib/repositories/demo-repository");
  idb = await import("@/lib/idb");
});

const newRepo = () => new demo.DemoRepository();

/** Keys of the media store (one per stored upload). */
async function mediaKeys(): Promise<string[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("gridline-studio", 1);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const rq = db.transaction("media", "readonly").objectStore("media").getAllKeys();
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  db.close();
  return keys.map(String);
}

const storedJson = async () => JSON.stringify(await idb.idbGetState<WorkspaceSnapshot>());

function png(name = "photo.png"): File {
  return new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], name, { type: "image/png" });
}

async function photoPost(repo: InstanceType<DemoModule["DemoRepository"]>, clientId = "client-kavo") {
  const upload = await repo.uploadFile(png(), "post-media");
  const post = await repo.createPost(
    {
      clientId,
      name: "Photo post",
      stage: "post",
      type: "image",
      caption: "",
      location: null,
      altText: null,
      hashtags: [],
      status: "draft",
      approvalStatus: "not_sent",
      scheduledAt: null,
      scheduledDay: null,
      publishedAt: null,
      isPinned: false,
      gridPosition: 99,
      likesCount: 0,
      commentsCount: 0,
    },
    [{ mediaType: "image", url: upload.url, thumbnailUrl: null, width: upload.width, height: upload.height, position: 0 }],
  );
  return { post, ref: upload.url };
}

describe("DemoRepository: workspace", () => {
  it("seeds on first load and persists it", async () => {
    const snapshot = await newRepo().loadSnapshot();
    expect(snapshot.clients.map((c) => c.id)).toEqual(["client-aurelle", "client-norr", "client-kavo"]);
    expect(snapshot.posts.every((p) => p.scheduledDay !== undefined)).toBe(true);
    expect((await newRepo().loadSnapshot()).clients).toHaveLength(3);
  });

  it("deleting a client removes everything that belonged to it", async () => {
    const repo = newRepo();
    await repo.deleteClient("client-aurelle");
    const s = await repo.loadSnapshot();
    expect(s.clients.some((c) => c.id === "client-aurelle")).toBe(false);
    for (const list of [s.posts, s.highlights, s.approvals, s.shareLinks, s.activity, s.notifications]) {
      expect(list.some((item) => "clientId" in item && item.clientId === "client-aurelle")).toBe(false);
    }
  });

  it("duplicating trims long names so the suffix fits", async () => {
    const repo = newRepo();
    const long = await repo.createClient({
      ...(await repo.loadSnapshot()).clients[0],
      name: "N".repeat(120),
      instagramUsername: "u".repeat(60),
    });
    const copy = await repo.duplicateClient(long.id);
    expect(copy.name).toHaveLength(120);
    expect(copy.name.endsWith(" copy")).toBe(true);
    expect(copy.instagramUsername).toHaveLength(60);
  });

  it("two tabs writing in turn don't overwrite each other", async () => {
    const tabA = newRepo();
    const tabB = newRepo();
    await tabA.loadSnapshot();
    await tabB.loadSnapshot(); // both now hold a cached copy
    const base = (await tabA.loadSnapshot()).clients[0];
    await tabA.createClient({ ...base, name: "From tab A" });
    await tabB.createClient({ ...base, name: "From tab B" });
    const names = (await newRepo().loadSnapshot()).clients.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["From tab A", "From tab B"]));
  });
});

describe("DemoRepository: media integrity", () => {
  it("never stores data: URLs — the editor's resolved image maps back to its ref", async () => {
    const repo = newRepo();
    const { post, ref } = await photoPost(repo);
    const displayed = await repo.resolveMediaUrl(ref); // what the UI holds
    expect(displayed.startsWith("data:image/png")).toBe(true);

    await repo.setPostMedia(post.id, [
      { mediaType: "image", url: displayed, thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
    ]);
    await repo.updateClient("client-kavo", { avatarUrl: displayed });

    const stored = await storedJson();
    expect(stored).not.toContain("data:");
    expect((await repo.loadSnapshot()).media.find((m) => m.postId === post.id)?.url).toBe(ref);
    expect(await mediaKeys()).toHaveLength(1);
  });

  it("stores an unknown inline image as a new media entry", async () => {
    const repo = newRepo();
    await repo.updateClient("client-norr", { avatarUrl: "data:image/png;base64,AAAA" });
    const avatar = (await repo.loadSnapshot()).clients.find((c) => c.id === "client-norr")?.avatarUrl;
    expect(avatar).toMatch(/^local:/);
    expect(await storedJson()).not.toContain("data:");
    expect(await repo.resolveMediaUrl(avatar!)).toBe("data:image/png;base64,AAAA");
  });

  it("deletes media once nothing references it; shared refs survive", async () => {
    const repo = newRepo();
    const { post, ref } = await photoPost(repo, "client-norr");
    const copy = await repo.duplicateClient("client-norr"); // shares the media ref
    await repo.deletePost(post.id);
    expect(await mediaKeys()).toEqual([ref.slice("local:".length)]); // copy still uses it

    const copiedPost = (await repo.loadSnapshot()).posts.find(
      (p) => p.clientId === copy.id && p.name === "Photo post",
    )!;
    await repo.deletePost(copiedPost.id);
    expect(await mediaKeys()).toEqual([]);
  });

  it("never touches uploads that aren't saved in the state yet", async () => {
    const repo = newRepo();
    const pending = await repo.uploadFile(png("pending.png"), "post-media");
    const { post } = await photoPost(repo);
    await repo.deletePost(post.id);
    expect(await mediaKeys()).toEqual([pending.url.slice("local:".length)]);
  });

  it("repairs a state saved by an older version", async () => {
    await newRepo().loadSnapshot(); // seed
    const old = (await idb.idbGetState<WorkspaceSnapshot>())!;
    const content = old.posts.find((p) => p.id === "content-a1")!;
    for (const p of old.posts) delete (p as Partial<typeof p>).scheduledDay;
    content.scheduledAt = new Date(2026, 7, 20, 0, 0).toISOString(); // local midnight, 20 Aug
    old.clients[0].avatarUrl = "data:image/png;base64,BBBB";
    await idb.idbPutState(old);

    vi.resetModules(); // a fresh "page load" on the same database
    const fresh = await import("@/lib/repositories/demo-repository");
    const snapshot = await new fresh.DemoRepository().loadSnapshot();
    const repaired = snapshot.posts.find((p) => p.id === "content-a1")!;
    expect(repaired).toMatchObject({ scheduledDay: "2026-08-20", scheduledAt: null });
    expect(snapshot.posts.every((p) => p.scheduledDay !== undefined)).toBe(true);
    expect(snapshot.clients[0].avatarUrl).toMatch(/^local:/);
  });
});

describe("DemoRepository: public share rules", () => {
  const TOKEN = "demo-aurelle-h3ritage";
  const reviewer = { authorName: "Rita", authorEmail: "rita@example.com" };

  it("the reviewer bundle has completed posts only, no emails, no share links", async () => {
    const result = await newRepo().resolveShareToken(TOKEN);
    if (typeof result === "string") throw new Error(result);
    expect(result.bundle.posts.length).toBeGreaterThan(0);
    expect(result.bundle.posts.every((p) => p.stage === "post")).toBe(true);
    expect(result.bundle.comments.every((c) => c.authorEmail === null)).toBe(true);
    expect(result.bundle.approvals.every((a) => a.reviewerEmail === null)).toBe(true);
    expect(result.bundle.shareLinks).toEqual([]);
  });

  it("refuses unknown, disabled and expired links", async () => {
    const repo = newRepo();
    expect(await repo.resolveShareToken("nope")).toBe("not_found");
    expect(await repo.resolveShareToken("demo-kavo-hu1la")).toBe("inactive");
    await repo.updateShareLink("sl-2", { expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(await repo.resolveShareToken("demo-norr-ostermalm")).toBe("expired");
  });

  it("enforces comments-off / approvals-off and keeps reviewers to completed posts", async () => {
    const repo = newRepo();
    expect(await repo.submitPublicComment(TOKEN, { ...reviewer, postId: "content-a1", body: "x" })).toBe(
      "not_found",
    );
    await repo.updateShareLink("sl-1", { allowComments: false, allowApproval: false });
    expect(await repo.submitPublicComment(TOKEN, { ...reviewer, postId: "post-a1", body: "x" })).toBe(
      "inactive",
    );
    expect(
      await repo.submitPublicApproval(TOKEN, {
        postId: "post-a1",
        reviewerName: "Rita",
        reviewerEmail: null,
        status: "approved",
        message: null,
      }),
    ).toBe("inactive");
  });

  it("an approval message becomes one comment, and both count as one submission", async () => {
    const repo = newRepo();
    for (let i = 0; i < 59; i++) {
      expect(typeof (await repo.submitPublicComment(TOKEN, { ...reviewer, postId: "post-a1", body: `c${i}` }))).toBe(
        "object",
      );
    }
    const approval = await repo.submitPublicApproval(TOKEN, {
      postId: "post-a3",
      reviewerName: "Rita",
      reviewerEmail: "rita@example.com",
      status: "changes_requested",
      message: "Brighter please",
    });
    expect(approval).toMatchObject({ status: "changes_requested", reviewerEmail: null }); // the 60th submission
    const s = await repo.loadSnapshot();
    expect(s.comments.filter((c) => c.body === "Brighter please" && c.commentType === "change_request")).toHaveLength(1);
    expect(s.posts.find((p) => p.id === "post-a3")?.approvalStatus).toBe("changes_requested");

    // 61st submission within 10 minutes → rate limited, nothing stored.
    expect(await repo.submitPublicComment(TOKEN, { ...reviewer, postId: "post-a1", body: "one too many" })).toBe(
      "rate_limited",
    );
    expect((await repo.loadSnapshot()).comments.some((c) => c.body === "one too many")).toBe(false);
  });
});
