import { cn } from "@/lib/cn";
import {
  APPROVAL_STATUS_LABELS,
  POST_STATUS_LABELS,
  type ApprovalStatus,
  type PostStatus,
} from "@/types/domain";

const approvalClasses: Record<ApprovalStatus, string> = {
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  awaiting_approval: "bg-amber-50 text-amber-800 border-amber-200",
  not_sent: "bg-panel-raised text-ink-soft border-line",
  changes_requested: "bg-accent-soft text-accent-deep border-accent/20",
};

const statusClasses: Record<PostStatus, string> = {
  draft: "bg-panel-raised text-ink-soft border-line",
  scheduled: "bg-sky-50 text-sky-800 border-sky-200",
  published: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

const badgeBase =
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium";

export function ApprovalBadge({ status, className }: { status: ApprovalStatus; className?: string }) {
  return (
    <span className={cn(badgeBase, approvalClasses[status], className)}>
      {APPROVAL_STATUS_LABELS[status]}
    </span>
  );
}

export function PostStatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  return (
    <span className={cn(badgeBase, statusClasses[status], className)}>
      {POST_STATUS_LABELS[status]}
    </span>
  );
}
