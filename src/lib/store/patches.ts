import type { WorkspaceSnapshot } from "@/lib/repositories/types";
import type { Activity, ShareLink, User } from "@/types/domain";
import type { SnapshotPatch } from "./workspace-store";

/**
 * Local snapshot patches for mutations whose result fully describes the
 * change in BOTH backends (no hidden side effects such as a bumped
 * `client.updatedAt`). Anything else must use a full reload. Each patch
 * returns a new snapshot and leaves its input untouched.
 */

/** Notifications marked read for the signed-in user: given ids, or all. */
export function notificationsRead(ids: string[] | "all"): SnapshotPatch<unknown> {
  return (snapshot) => ({
    ...snapshot,
    notifications: snapshot.notifications.map((n) =>
      !n.isRead && (ids === "all" || ids.includes(n.id))
        ? { ...n, isRead: true }
        : n,
    ),
  });
}

function upsertShareLink(snapshot: WorkspaceSnapshot, link: ShareLink): WorkspaceSnapshot {
  const exists = snapshot.shareLinks.some((l) => l.id === link.id);
  return {
    ...snapshot,
    shareLinks: exists
      ? snapshot.shareLinks.map((l) => (l.id === link.id ? link : l))
      : [...snapshot.shareLinks, link],
  };
}

/** A share link as returned by create / update / regenerate. */
export const shareLinkSaved: SnapshotPatch<ShareLink> = (snapshot, link) =>
  upsertShareLink(snapshot, link);

/** A new share link plus the activity entry recorded for it. */
export const shareLinkCreated: SnapshotPatch<{ link: ShareLink; activity: Activity }> = (
  snapshot,
  { link, activity },
) => {
  const next = upsertShareLink(snapshot, link);
  // Newest first, capped like both backends' activity feed.
  return { ...next, activity: [activity, ...next.activity].slice(0, 200) };
};

/** Display-name change: only the fields that changed (the avatar is left as displayed). */
export const userRenamed: SnapshotPatch<User> = (snapshot, user) => ({
  ...snapshot,
  user: { ...snapshot.user, displayName: user.displayName, updatedAt: user.updatedAt },
});

/** A deleted share link (nothing else in the snapshot changes). */
export function shareLinkDeleted(id: string): SnapshotPatch<unknown> {
  return (snapshot) => ({
    ...snapshot,
    shareLinks: snapshot.shareLinks.filter((l) => l.id !== id),
  });
}
