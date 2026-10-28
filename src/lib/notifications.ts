import type { AppNotification } from "@/types/domain";

/** The bell's list: unread only (default), or everything still kept. */
export type NotificationView = "unread" | "all";

/**
 * Read notifications older than this are deleted by the backend (migration
 * 0011 once every recipient has read them; immediately in demo mode), so
 * the "All" view never shows them either.
 */
export const READ_NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Newest first. */
export function visibleNotifications(
  notifications: AppNotification[],
  view: NotificationView,
  now: Date = new Date(),
): AppNotification[] {
  const cutoff = now.getTime() - READ_NOTIFICATION_TTL_MS;
  return notifications
    .filter((n) =>
      view === "unread" ? !n.isRead : !n.isRead || new Date(n.createdAt).getTime() >= cutoff,
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
