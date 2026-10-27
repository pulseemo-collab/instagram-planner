import { describe, expect, it } from "vitest";
import {
  clientApprovalRollup,
  dashboardStats,
  postsForClient,
  realPosts,
  upcomingScheduledPosts,
} from "@/lib/derive";
import { buildIgPostDetail } from "@/lib/instagram/map-post";
import { buildIgProfile, parseMediaRef, sortForGrid } from "@/lib/instagram/map-profile";
import { searchWorkspace } from "@/lib/search";
import type { Post } from "@/types/domain";
import { makeClient, makeComment, makeMedia, makePost, makeSnapshot } from "./fixtures";

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe("derive", () => {
  it("realPosts / postsForClient exclude designer content packages", () => {
    const snapshot = makeSnapshot({
      posts: [
        makePost({ id: "a", clientId: "c1" }),
        makePost({ id: "b", clientId: "c1", stage: "content" }),
        makePost({ id: "c", clientId: "c2" }),
      ],
    });
    expect(realPosts(snapshot.posts).map((p) => p.id)).toEqual(["a", "c"]);
    expect(postsForClient(snapshot, "c1").map((p) => p.id)).toEqual(["a"]);
  });

  it("rolls approvals up: changes > awaiting > all approved > not sent", () => {
    const p = (approvalStatus: Post["approvalStatus"]) => makePost({ approvalStatus });
    expect(clientApprovalRollup([p("approved"), p("changes_requested"), p("awaiting_approval")])).toBe(
      "changes_requested",
    );
    expect(clientApprovalRollup([p("approved"), p("awaiting_approval")])).toBe("awaiting_approval");
    expect(clientApprovalRollup([p("approved"), p("approved")])).toBe("approved");
    expect(clientApprovalRollup([p("approved"), p("not_sent")])).toBe("not_sent");
    expect(clientApprovalRollup([])).toBe("not_sent");
  });

  it("dashboard stats count only completed posts", () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15, 12).toISOString();
    const snapshot = makeSnapshot({
      clients: [makeClient({ id: "c1" }), makeClient({ id: "c2" })],
      posts: [
        makePost({ id: "1", status: "draft" }),
        makePost({ id: "2", approvalStatus: "awaiting_approval" }),
        makePost({ id: "3", status: "scheduled", scheduledAt: thisMonth }),
        makePost({ id: "4", stage: "content", status: "draft", approvalStatus: "awaiting_approval" }),
      ],
    });
    expect(dashboardStats(snapshot)).toEqual({
      activeClients: 2,
      draftPosts: 2,
      awaitingApproval: 1,
      scheduledThisMonth: 1,
    });
  });

  it("upcoming posts are future scheduled posts, soonest first", () => {
    const snapshot = makeSnapshot({
      posts: [
        makePost({ id: "later", status: "scheduled", scheduledAt: inDays(5) }),
        makePost({ id: "soon", status: "scheduled", scheduledAt: inDays(1) }),
        makePost({ id: "past", status: "scheduled", scheduledAt: inDays(-3) }),
        makePost({ id: "content", stage: "content", status: "scheduled", scheduledAt: inDays(2) }),
      ],
    });
    expect(upcomingScheduledPosts(snapshot).map((p) => p.id)).toEqual(["soon", "later"]);
  });
});

describe("instagram mappers", () => {
  it("parseMediaRef: gradients become art, local: refs are never rendered raw", () => {
    expect(parseMediaRef("gradient:#111/#222/#333/120")).toEqual({
      art: { from: "#111", via: "#222", to: "#333", angle: 120 },
    });
    expect(parseMediaRef("local:abc").imageUrl).toBeUndefined();
    expect(parseMediaRef("https://cdn.example/x.jpg").imageUrl).toBe("https://cdn.example/x.jpg");
    expect(parseMediaRef(null).imageUrl).toBeUndefined();
  });

  it("orders the grid pinned-first, then by grid position", () => {
    const posts = [
      makePost({ id: "b", gridPosition: 1 }),
      makePost({ id: "pinned", gridPosition: 5, isPinned: true }),
      makePost({ id: "a", gridPosition: 0 }),
    ];
    expect(sortForGrid(posts).map((p) => p.id)).toEqual(["pinned", "a", "b"]);
  });

  it("buildIgProfile shows completed posts only; reels tab lists reels", () => {
    const profile = buildIgProfile(
      makeClient({ avatarUrl: "local:avatar" }),
      [],
      [
        makePost({ id: "img", gridPosition: 0 }),
        makePost({ id: "reel", type: "reel", gridPosition: 1 }),
        makePost({ id: "draft-package", stage: "content", gridPosition: 2 }),
      ],
      [makeMedia({ postId: "img" })],
    );
    expect(profile.posts.map((p) => p.id)).toEqual(["img", "reel"]);
    expect(profile.reels.map((p) => p.id)).toEqual(["reel"]);
    expect(profile.posts[0].imageUrl).toBe("https://cdn.example/a.jpg");
    expect(profile.avatar.imageUrl).toBeUndefined(); // unresolved local: ref
  });

  it("buildIgPostDetail labels published, scheduled, planned and draft posts", () => {
    const client = makeClient();
    const label = (overrides: Parameters<typeof makePost>[0]) =>
      buildIgPostDetail(client, makePost(overrides), [], []).timestampLabel;
    expect(label({ publishedAt: "2026-06-12T10:00:00.000Z" })).toMatch(/Jun 12/);
    expect(label({ scheduledAt: "2026-07-18T10:00:00.000Z" })).toMatch(/^Scheduled for Jul 18/);
    expect(label({ stage: "content", scheduledDay: "2026-08-01" })).toMatch(/^Planned for Aug 1/);
    expect(label({})).toBe("Draft");
  });

  it("buildIgPostDetail separates real videos from placeholders and keeps two comments", () => {
    const detail = buildIgPostDetail(
      makeClient(),
      makePost({ type: "carousel" }),
      [
        makeMedia({ id: "v", mediaType: "video", url: "https://cdn.example/v.mp4", thumbnailUrl: "https://cdn.example/v.jpg", position: 1 }),
        makeMedia({ id: "g", mediaType: "video", url: "gradient:#1/#2/#3/90", position: 0 }),
      ],
      [makeComment({ id: "1", commentType: "change_request" }), makeComment({ id: "2" }), makeComment({ id: "3" })],
    );
    expect(detail.media.map((m) => m.id)).toEqual(["g", "v"]);
    expect(detail.media[0].videoUrl).toBeUndefined();
    expect(detail.media[1]).toMatchObject({ videoUrl: "https://cdn.example/v.mp4", posterUrl: "https://cdn.example/v.jpg" });
    expect(detail.comments).toHaveLength(2);
    expect(detail.comments[0].isChangeRequest).toBe(true);
    expect(detail.commentsCount).toBe(3);
  });
});

describe("searchWorkspace", () => {
  const snapshot = makeSnapshot({
    clients: [
      makeClient({ id: "c1", name: "Maison Aurelle", instagramUsername: "maisonaurelle" }),
      makeClient({ id: "c2", name: "Kavo Coffee", instagramUsername: "kavo.coffee" }),
    ],
    posts: [
      makePost({ id: "p1", clientId: "c1", name: "Héritage signet", caption: "Gold ring" }),
      makePost({ id: "p2", clientId: "c1", name: "Campaign", caption: "Héritage outtake" }),
      makePost({ id: "p3", clientId: "c2", name: "Post 1", stage: "content" }),
    ],
  });

  it("is accent-insensitive and ranks name-prefix matches first", () => {
    const { posts } = searchWorkspace(snapshot, "heritage");
    expect(posts.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(posts[0]).toMatchObject({ href: "/clients/c1/posts/p1", subtitle: "Maison Aurelle · Post" });
  });

  it("matches clients by name or username; every word must match", () => {
    expect(searchWorkspace(snapshot, "kavo").clients.map((c) => c.id)).toEqual(["c2"]);
    expect(searchWorkspace(snapshot, "@?").clients).toEqual([]);
    expect(searchWorkspace(snapshot, "maison coffee").clients).toEqual([]);
    expect(searchWorkspace(snapshot, "aurelle maison").clients.map((c) => c.id)).toEqual(["c1"]);
  });

  it("labels content packages and returns nothing for an empty query", () => {
    expect(searchWorkspace(snapshot, "post 1").posts[0].subtitle).toBe("Kavo Coffee · Content");
    expect(searchWorkspace(snapshot, "   ")).toEqual({ clients: [], posts: [] });
  });

  it("caps each group", () => {
    const many = makeSnapshot({
      posts: Array.from({ length: 10 }, (_, i) => makePost({ id: `p${i}`, name: `Launch ${i}` })),
    });
    expect(searchWorkspace(many, "launch", 4).posts).toHaveLength(4);
  });
});
