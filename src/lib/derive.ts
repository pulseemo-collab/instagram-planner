import type { WorkspaceSnapshot } from "@/lib/repositories/types";
import type { ApprovalStatus, Client, Post } from "@/types/domain";

/** Roll a client's post approval states up to a single badge. */
export function clientApprovalRollup(posts: Post[]): ApprovalStatus {
  if (posts.some((p) => p.approvalStatus === "changes_requested")) return "changes_requested";
  if (posts.some((p) => p.approvalStatus === "awaiting_approval")) return "awaiting_approval";
  if (posts.length > 0 && posts.every((p) => p.approvalStatus === "approved")) return "approved";
  return "not_sent";
}

export function postsForClient(snapshot: WorkspaceSnapshot, clientId: string): Post[] {
  return snapshot.posts.filter((p) => p.clientId === clientId);
}

export interface DashboardStats {
  activeClients: number;
  draftPosts: number;
  awaitingApproval: number;
  scheduledThisMonth: number;
}

export function dashboardStats(snapshot: WorkspaceSnapshot): DashboardStats {
  const now = new Date();
  return {
    activeClients: snapshot.clients.length,
    draftPosts: snapshot.posts.filter((p) => p.status === "draft").length,
    awaitingApproval: snapshot.posts.filter((p) => p.approvalStatus === "awaiting_approval").length,
    scheduledThisMonth: snapshot.posts.filter((p) => {
      if (p.status !== "scheduled" || !p.scheduledAt) return false;
      const date = new Date(p.scheduledAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length,
  };
}

export function clientsSortedByUpdate(snapshot: WorkspaceSnapshot): Client[] {
  return [...snapshot.clients].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function upcomingScheduledPosts(snapshot: WorkspaceSnapshot, limit = 6): Post[] {
  const nowMs = Date.now() - 12 * 60 * 60 * 1000;
  return snapshot.posts
    .filter((p) => p.status === "scheduled" && p.scheduledAt && new Date(p.scheduledAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, limit);
}
