"use client";

import { useMemo, useState } from "react";
import { CircleCheck, MessageSquare, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApprovalBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/dates";
import { useMutate } from "@/lib/store/hooks";
import type { Approval, Comment, Post } from "@/types/domain";

interface ReviewActivityProps {
  post: Post;
  /** Comments already filtered to this post. */
  comments: Comment[];
  /** Approvals already filtered to this post. */
  approvals: Approval[];
  /** Owner's email — their own comments aren't client review events. */
  ownerEmail: string;
}

interface ReviewEvent {
  id: string;
  kind: "approved" | "changes_requested" | "feedback";
  name: string;
  message: string | null;
  createdAt: string;
}

const EVENT_COPY: Record<ReviewEvent["kind"], string> = {
  approved: "approved the post",
  changes_requested: "requested changes",
  feedback: "left feedback",
};

/**
 * Client review history + current status for one post, with the resubmit
 * action. Approval and change-request events are immutable — the list only
 * ever grows, even when the current status changes later.
 */
export function ReviewActivity({ post, comments, approvals, ownerEmail }: ReviewActivityProps) {
  const mutate = useMutate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const events = useMemo<ReviewEvent[]>(() => {
    const fromApprovals = approvals.map<ReviewEvent>((a) => ({
      id: `approval-${a.id}`,
      kind: a.status,
      name: a.reviewerName,
      message: a.message,
      createdAt: a.createdAt,
    }));
    // Change-request comments duplicate the approval event's message, and an
    // approval note is mirrored as a general comment — both would repeat an
    // approval event above. Owner comments are editor chatter, not review
    // activity.
    const approvalMessages = new Set(approvals.map((a) => a.message).filter(Boolean));
    const fromComments = comments
      .filter(
        (c) =>
          c.commentType === "general" &&
          c.authorEmail !== ownerEmail &&
          !approvalMessages.has(c.body),
      )
      .map<ReviewEvent>((c) => ({
        id: `comment-${c.id}`,
        kind: "feedback",
        name: c.authorName,
        message: c.body,
        createdAt: c.createdAt,
      }));
    return [...fromApprovals, ...fromComments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [approvals, comments, ownerEmail]);

  const resubmitLabel =
    post.approvalStatus === "changes_requested" ? "Resubmit for review" : "Send for review";
  const canResubmit =
    post.approvalStatus === "not_sent" || post.approvalStatus === "changes_requested";

  async function resubmit() {
    setBusy(true);
    try {
      await mutate(async (repo) => {
        await repo.updatePost(post.id, { approvalStatus: "awaiting_approval" });
        await repo.recordActivity({
          clientId: post.clientId,
          type: "post_updated",
          description: `${post.name || "A post"} was sent for client review`,
        });
      });
      toast("Sent for review — share the preview link with your client");
    } catch {
      toast("Could not update the review status — try again", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="review-activity"
      aria-label="Client review"
      className="min-w-0 scroll-mt-24 rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[13.5px] font-semibold tracking-tight text-ink">Client review</h3>
        <ApprovalBadge status={post.approvalStatus} />
        {canResubmit && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={() => void resubmit()}
          >
            <Send className="size-3.5" aria-hidden="true" />
            {resubmitLabel}
          </Button>
        )}
      </div>

      {post.approvalStatus === "awaiting_approval" && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
          Waiting for the client — responses through the share link land here and in the
          notification bell.
        </p>
      )}

      {events.length === 0 ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
          No client responses yet. Share a preview link and approvals or change requests will
          appear here.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-panel-raised"
              >
                {event.kind === "approved" ? (
                  <CircleCheck className="size-3.5 text-emerald-600" />
                ) : event.kind === "changes_requested" ? (
                  <Undo2 className="size-3.5 text-accent-deep" />
                ) : (
                  <MessageSquare className="size-3.5 text-ink-soft" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-ink">
                  <span className="font-medium">{event.name}</span> {EVENT_COPY[event.kind]}
                </p>
                {event.message && (
                  <p className="mt-0.5 rounded-lg bg-panel-raised px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                    {event.message}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-ink-faint">{formatDateTime(event.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
