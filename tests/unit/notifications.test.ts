import { describe, expect, it } from "vitest";
import { visibleNotifications } from "@/lib/notifications";
import type { AppNotification } from "@/types/domain";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const notification = (id: string, isRead: boolean, createdAt: string): AppNotification => ({
  id,
  audience: "team",
  clientId: "c1",
  postId: null,
  subjectUserId: null,
  type: "review_feedback_received",
  title: id,
  message: "m",
  isRead,
  createdAt,
});

describe("visibleNotifications", () => {
  const list = [
    notification("read-recent", true, daysAgo(2)),
    notification("unread-old", false, daysAgo(45)),
    notification("unread-new", false, daysAgo(1)),
    notification("read-old", true, daysAgo(31)),
  ];

  it("Unread (default) hides every read notification, newest first", () => {
    expect(visibleNotifications(list, "unread", NOW).map((n) => n.id)).toEqual(["unread-new", "unread-old"]);
  });

  it("All adds read ones from the last 30 days", () => {
    expect(visibleNotifications(list, "all", NOW).map((n) => n.id)).toEqual([
      "unread-new",
      "read-recent",
      "unread-old",
    ]);
  });
});
