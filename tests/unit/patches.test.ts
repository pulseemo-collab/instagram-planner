import { describe, expect, it } from "vitest";
import { notificationsRead, shareLinkCreated, shareLinkSaved, userRenamed } from "@/lib/store/patches";
import type { Activity, AppNotification, ShareLink } from "@/types/domain";
import { makeSnapshot } from "./fixtures";

const notification = (id: string, recipientId = "u1", isRead = false): AppNotification => ({
  id,
  recipientId,
  clientId: "c1",
  postId: null,
  type: "review_feedback_received",
  title: "t",
  message: "m",
  isRead,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const link = (id: string, token: string, isActive = true): ShareLink => ({
  id,
  clientId: "c1",
  token,
  isActive,
  expiresAt: null,
  allowComments: true,
  allowApproval: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("snapshot patches", () => {
  it("marks only the signed-in user's chosen notifications read, without mutating input", () => {
    const snapshot = makeSnapshot({
      notifications: [notification("a"), notification("b"), notification("other", "u2")],
    });
    const one = notificationsRead(["a"])(snapshot, undefined);
    expect(one.notifications.map((n) => n.isRead)).toEqual([true, false, false]);
    const all = notificationsRead("all")(snapshot, undefined);
    expect(all.notifications.map((n) => n.isRead)).toEqual([true, true, false]);
    expect(snapshot.notifications.every((n) => !n.isRead)).toBe(true);
    expect(all).not.toBe(snapshot);
  });

  it("upserts a saved share link", () => {
    const snapshot = makeSnapshot({ shareLinks: [link("l1", "old")] });
    expect(shareLinkSaved(snapshot, link("l1", "new", false)).shareLinks).toEqual([link("l1", "new", false)]);
    expect(shareLinkSaved(snapshot, link("l2", "x")).shareLinks.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(snapshot.shareLinks).toEqual([link("l1", "old")]);
  });

  it("adds a created link and prepends its activity entry, capped at 200", () => {
    const activity = (id: string): Activity => ({
      id,
      clientId: "c1",
      type: "share_link_created",
      description: id,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const snapshot = makeSnapshot({ activity: Array.from({ length: 200 }, (_, i) => activity(`old${i}`)) });
    const next = shareLinkCreated(snapshot, { link: link("l1", "t"), activity: activity("new") });
    expect(next.shareLinks).toHaveLength(1);
    expect(next.activity[0].id).toBe("new");
    expect(next.activity).toHaveLength(200);
  });

  it("renames the user but keeps the displayed avatar", () => {
    const snapshot = makeSnapshot();
    snapshot.user.avatarUrl = "data:image/png;base64,AAA";
    const next = userRenamed(snapshot, {
      ...snapshot.user,
      displayName: "Morgan",
      avatarUrl: "local:raw-ref",
      updatedAt: "2026-02-02T00:00:00.000Z",
    });
    expect(next.user).toMatchObject({
      displayName: "Morgan",
      avatarUrl: "data:image/png;base64,AAA",
      updatedAt: "2026-02-02T00:00:00.000Z",
    });
  });
});
