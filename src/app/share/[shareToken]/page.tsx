"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CircleCheck, Grid3x3, LinkIcon, MessageSquare, Undo2 } from "lucide-react";
import { InstagramProfile } from "@/components/instagram/instagram-profile";
import { InstagramPostDetail } from "@/components/instagram/post-detail";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { buildIgPostDetail } from "@/lib/instagram/map-post";
import { buildIgProfile } from "@/lib/instagram/map-profile";
import { resolveMediaRefs } from "@/lib/media/resolve-media";
import { getRepository, isShareError } from "@/lib/repositories";
import type { ShareError, ShareResolution } from "@/lib/repositories/types";
import { APPROVAL_STATUS_LABELS, type ClientBundle } from "@/types/domain";

const REVIEWER_KEY = "gridline-reviewer";

interface Reviewer {
  name: string;
  email: string;
}

function loadReviewer(): Reviewer {
  try {
    const raw = localStorage.getItem(REVIEWER_KEY);
    if (raw) return JSON.parse(raw) as Reviewer;
  } catch {
    // fall through
  }
  return { name: "", email: "" };
}

const shareErrorCopy: Record<ShareError, { title: string; body: string }> = {
  not_found: {
    title: "Preview not found",
    body: "This link doesn't match any preview. Double-check the URL with whoever sent it.",
  },
  inactive: {
    title: "Preview disabled",
    body: "The creator has turned this preview link off. Ask them for a fresh link.",
  },
  expired: {
    title: "Preview expired",
    body: "This link has passed its expiration date. Ask the creator for a new one.",
  },
  rate_limited: {
    title: "Too many responses",
    body: "This link has received a lot of responses in a short time. Please try again in a few minutes.",
  },
};

const RATE_LIMITED_TOAST =
  "Too many responses from this link right now — please try again in a few minutes.";

function postsLabel(count: number): string {
  return `${count} ${count === 1 ? "post" : "posts"}`;
}

/** Resolve the token and make its media displayable (demo `local:` refs). */
async function loadShare(token: string): Promise<ShareResolution | ShareError> {
  const repo = await getRepository();
  const result = await repo.resolveShareToken(token);
  if (!isShareError(result)) {
    const { bundle } = result;
    await resolveMediaRefs(repo, {
      clients: [bundle.client],
      highlights: bundle.highlights,
      media: bundle.media,
    });
  }
  return result;
}

/** Completed posts the owner has sent for review and nobody has answered yet. */
function pendingPosts(bundle: ClientBundle) {
  return bundle.posts.filter((p) => p.stage === "post" && p.approvalStatus === "awaiting_approval");
}

function validateReviewer(reviewer: Reviewer): string | null {
  if (!reviewer.name.trim() || reviewer.name.trim().length < 2) return "Please enter your name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reviewer.email)) return "Please enter a valid email.";
  return null;
}

function SharePageInner() {
  const params = useParams<{ shareToken: string }>();
  const { toast } = useToast();

  const [resolution, setResolution] = useState<ShareResolution | ShareError | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState<Reviewer>(() =>
    typeof window === "undefined" ? { name: "", email: "" } : loadReviewer(),
  );
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Approval needs an explicit confirmation click before it submits.
  const [confirmApprove, setConfirmApprove] = useState(false);
  // Synchronous re-entry guard: two rapid clicks land before React re-renders
  // with `busy`, so the state flag alone can't stop a duplicate submission.
  const busyRef = useRef(false);

  // Reset the confirm step and stale errors when switching posts
  // (render-phase sync of this component's own state).
  const [lastOpenPostId, setLastOpenPostId] = useState(openPostId);
  if (openPostId !== lastOpenPostId) {
    setLastOpenPostId(openPostId);
    setConfirmApprove(false);
    setFormError(null);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await loadShare(params.shareToken);
        if (!cancelled) setResolution(result);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.shareToken]);

  const bundle: ClientBundle | null =
    resolution && !isShareError(resolution) ? resolution.bundle : null;

  const igProfile = useMemo(() => {
    if (!bundle) return null;
    return buildIgProfile(bundle.client, bundle.highlights, bundle.posts, bundle.media);
  }, [bundle]);

  const openPost = bundle?.posts.find((p) => p.id === openPostId) ?? null;
  const openPostDetail = useMemo(() => {
    if (!bundle || !openPost) return null;
    return buildIgPostDetail(
      bundle.client,
      openPost,
      bundle.media,
      bundle.comments.filter((c) => c.postId === openPost.id),
    );
  }, [bundle, openPost]);

  if (loadFailed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Couldn&apos;t load this preview</h1>
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-soft">
          Check your connection and refresh the page to try again.
        </p>
      </div>
    );
  }

  if (resolution === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading preview">
        <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
      </div>
    );
  }

  if (isShareError(resolution)) {
    const copy = shareErrorCopy[resolution];
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-line bg-panel text-ink-faint shadow-panel">
          <LinkIcon className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink">{copy.title}</h1>
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-soft">{copy.body}</p>
      </div>
    );
  }

  const { shareLink } = resolution;
  const client = bundle!.client;

  function persistReviewer(): boolean {
    const error = validateReviewer(reviewer);
    setFormError(error);
    if (error) return false;
    localStorage.setItem(REVIEWER_KEY, JSON.stringify(reviewer));
    return true;
  }

  async function refreshBundle() {
    const result = await loadShare(params.shareToken);
    if (!isShareError(result)) setResolution(result);
  }

  async function submitDecision(status: "approved" | "changes_requested", postId: string, message: string | null) {
    if (busyRef.current) return;
    if (!persistReviewer()) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const repo = await getRepository();
      const result = await repo.submitPublicApproval(params.shareToken, {
        postId,
        reviewerName: reviewer.name.trim(),
        reviewerEmail: reviewer.email.trim(),
        status,
        message,
      });
      if (isShareError(result)) {
        toast(
          result === "rate_limited" ? RATE_LIMITED_TOAST : "This link no longer accepts approvals",
          "error",
        );
        return;
      }
      // A message is mirrored into the comment thread by the repository.
      await refreshBundle();
      toast(status === "approved" ? "Post approved" : "Change request sent");
      setFeedback("");
    } catch {
      toast("Something went wrong — your response wasn't saved. Please try again.", "error");
    } finally {
      busyRef.current = false;
      setBusy(false);
      setConfirmApprove(false);
    }
  }

  async function submitComment(postId: string, body: string) {
    if (busyRef.current) return;
    if (!persistReviewer()) return;
    if (!body.trim() || body.trim().length < 2) {
      setFormError("Write a short message first.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const repo = await getRepository();
      const result = await repo.submitPublicComment(params.shareToken, {
        postId,
        authorName: reviewer.name.trim(),
        authorEmail: reviewer.email.trim(),
        body: body.trim().slice(0, 2000),
      });
      if (isShareError(result)) {
        toast(
          result === "rate_limited" ? RATE_LIMITED_TOAST : "This link no longer accepts comments",
          "error",
        );
        return;
      }
      await refreshBundle();
      toast("Comment sent");
      setFeedback("");
    } catch {
      toast("Something went wrong — your comment wasn't saved. Please try again.", "error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function approveAllPending() {
    if (busyRef.current) return;
    if (!persistReviewer()) return;
    // Exactly the posts counted as "waiting for your approval" below.
    const pending = pendingPosts(bundle!);
    if (pending.length === 0) {
      toast("Nothing waiting for approval", "info");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    let approved = 0;
    try {
      const repo = await getRepository();
      for (const post of pending) {
        const result = await repo.submitPublicApproval(params.shareToken, {
          postId: post.id,
          reviewerName: reviewer.name.trim(),
          reviewerEmail: reviewer.email.trim(),
          status: "approved",
          message: null,
        });
        if (isShareError(result)) {
          // Stop at the first refusal and say exactly how far we got.
          await refreshBundle();
          toast(
            result === "rate_limited"
              ? `Approved ${approved} of ${postsLabel(pending.length)}. Too many responses right now — use “Approve all pending” again in a few minutes for the rest.`
              : `Approved ${approved} of ${postsLabel(pending.length)}. This link no longer accepts approvals.`,
            "error",
          );
          return;
        }
        approved += 1;
      }
      await refreshBundle();
      toast(`${postsLabel(approved)} approved`);
    } catch {
      toast(
        `Approved ${approved} of ${postsLabel(pending.length)}. Something went wrong — please try again for the rest.`,
        "error",
      );
      await refreshBundle();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const pendingCount = pendingPosts(bundle!).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-6 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Content preview
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">{client.name}</h1>
        <p className="mt-0.5 text-[13px] text-ink-soft">
          Review the planned feed{shareLink.allowApproval ? " and approve posts" : ""} — tap any post
          for details.
        </p>
      </header>

      <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-10">
        {/* Instagram preview — clean, no app chrome inside */}
        <div className="mx-auto w-full min-w-0 max-w-[400px]">
          <div className="overflow-hidden rounded-[28px] border border-line shadow-panel-hover">
            <div className="h-[720px]">
              {openPostDetail ? (
                <InstagramPostDetail
                  post={openPostDetail}
                  theme={client.theme}
                  onBack={() => setOpenPostId(null)}
                />
              ) : (
                igProfile && (
                  <InstagramProfile
                    profile={igProfile}
                    theme={client.theme}
                    onPostOpen={(postId) => setOpenPostId(postId)}
                  />
                )
              )}
            </div>
          </div>
        </div>

        {/* Reviewer panel — outside the Instagram UI */}
        <div className="min-w-0 space-y-4 pb-8">
          <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">Your details</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">Attached to comments and approvals.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="Name"
                value={reviewer.name}
                onChange={(e) => setReviewer((r) => ({ ...r, name: e.target.value }))}
                autoComplete="name"
              />
              <TextField
                label="Email"
                type="email"
                value={reviewer.email}
                onChange={(e) => setReviewer((r) => ({ ...r, email: e.target.value }))}
                autoComplete="email"
              />
            </div>
            {formError && (
              <p role="alert" className="mt-2 text-[12px] text-red-700">
                {formError}
              </p>
            )}
          </section>

          {openPost ? (
            <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">This post</h2>
                <span className="rounded-full bg-panel-raised px-2 py-0.5 text-[10.5px] font-medium text-ink-soft">
                  {APPROVAL_STATUS_LABELS[openPost.approvalStatus]}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenPostId(null)}
                  className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft hover:text-ink"
                >
                  <Undo2 className="size-3.5" aria-hidden="true" />
                  Back to grid
                </button>
              </div>
              <TextAreaField
                label="Message (optional for approval, required for changes)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What should change?"
                className="mt-1"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {shareLink.allowApproval && (
                  <>
                    <Button
                      variant="primary"
                      disabled={busy || openPost.approvalStatus === "approved"}
                      onClick={() => {
                        if (!persistReviewer()) return;
                        if (!confirmApprove) {
                          setConfirmApprove(true);
                          return;
                        }
                        void submitDecision("approved", openPost.id, feedback.trim() || null);
                      }}
                    >
                      <CircleCheck className="size-4" aria-hidden="true" />
                      {confirmApprove ? "Confirm approval" : "Approve"}
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setConfirmApprove(false);
                        if (!feedback.trim()) {
                          setFormError("Describe the change you need first.");
                          return;
                        }
                        void submitDecision("changes_requested", openPost.id, feedback.trim());
                      }}
                    >
                      Request changes
                    </Button>
                  </>
                )}
                {shareLink.allowComments && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void submitComment(openPost.id, feedback)}
                  >
                    <MessageSquare className="size-4" aria-hidden="true" />
                    Comment only
                  </Button>
                )}
              </div>
              <p role="status" className="mt-2 min-h-4 text-[12px] text-ink-faint">
                {confirmApprove && !busy
                  ? "Click Confirm approval to record your approval."
                  : busy
                    ? "Sending…"
                    : ""}
              </p>
            </section>
          ) : (
            <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
              <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">Review</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                {pendingCount > 0
                  ? `${pendingCount} ${pendingCount === 1 ? "post is" : "posts are"} waiting for your approval. Tap a post in the grid to review it individually.`
                  : "Tap any post in the grid to leave feedback on it."}
              </p>
              {shareLink.allowApproval && (
                <Button
                  variant="primary"
                  className="mt-3"
                  disabled={busy || pendingCount === 0}
                  onClick={() => void approveAllPending()}
                >
                  <CircleCheck className="size-4" aria-hidden="true" />
                  Approve all pending
                </Button>
              )}
              <div className="mt-4 border-t border-line pt-3">
                <span className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                  <Grid3x3 className="size-3.5" aria-hidden="true" />
                  {bundle!.posts.length} planned posts · {bundle!.highlights.length} highlights
                </span>
              </div>
            </section>
          )}
        </div>
      </div>

      <footer className="mt-auto pt-6 text-center text-[11px] text-ink-faint">
        Prepared with Gridline Studio
      </footer>
    </div>
  );
}

export default function SharePage() {
  return (
    <ToastProvider>
      <SharePageInner />
    </ToastProvider>
  );
}
