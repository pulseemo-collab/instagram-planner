"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Images, Trash2 } from "lucide-react";
import { InstagramPostDetail } from "@/components/instagram/post-detail";
import { PhoneFrame } from "@/components/preview/phone-frame";
import { PostForm, type PostDraft } from "@/components/posts/post-form";
import { ReviewActivity } from "@/components/posts/review-activity";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ApprovalBadge, PostStatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { dayKeyToNumeric, formatDateTime } from "@/lib/dates";
import { buildIgPostDetail } from "@/lib/instagram/map-post";
import { useAction, useWorkspace } from "@/lib/store/hooks";
import type { Post, PostMedia } from "@/types/domain";

export default function PostDetailPage() {
  const params = useParams<{ clientId: string; postId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Opened from the calendar → back returns to the calendar (client + month
  // state are persisted by the calendar page itself).
  const fromCalendar = searchParams.get("from") === "calendar";
  // Opened from a notification → bring the review activity into view.
  const focusReview = searchParams.get("focus") === "review";
  const { status, snapshot } = useWorkspace();
  const run = useAction();
  const { toast } = useToast();

  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const client = snapshot?.clients.find((c) => c.id === params.clientId) ?? null;
  const post = snapshot?.posts.find((p) => p.id === params.postId) ?? null;

  const comments = useMemo(
    () =>
      (snapshot?.comments ?? [])
        .filter((c) => c.postId === params.postId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [snapshot, params.postId],
  );

  // The phone renders the unsaved draft live where one exists; otherwise the
  // stored post.
  const detail = useMemo(() => {
    if (!client || !post || !snapshot) return null;
    const effectivePost: Post = draft
      ? {
          ...post,
          name: draft.name,
          type: draft.type,
          caption: draft.caption,
          hashtags: draft.hashtags,
          location: draft.location,
          altText: draft.altText,
        }
      : post;
    const effectiveMedia: PostMedia[] = draft
      ? draft.media.map((m, index) => ({
          id: m.id ?? `draft-${index}`,
          postId: post.id,
          mediaType: m.mediaType,
          url: m.previewUrl ?? m.url,
          thumbnailUrl: m.coverPreviewUrl ?? m.thumbnailUrl,
          width: m.width,
          height: m.height,
          position: index,
          createdAt: post.createdAt,
        }))
      : snapshot.media;
    return buildIgPostDetail(client, effectivePost, effectiveMedia, comments);
  }, [client, post, snapshot, comments, draft]);

  const ready = status === "ready" && Boolean(post);
  useEffect(() => {
    if (!focusReview || !ready) return;
    document.getElementById("review-activity")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusReview, ready]);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  if (!client || !post || !detail) {
    return (
      <EmptyState
        icon={Images}
        title="Post not found"
        description="This post may have been deleted."
        action={
          <Button variant="primary" onClick={() => router.push(`/clients/${params.clientId}`)}>
            Back to workspace
          </Button>
        }
      />
    );
  }

  async function handleDelete() {
    setDeleteBusy(true);
    const result = await run((repo) => repo.deletePost(post!.id));
    setDeleteBusy(false);
    if (!result.ok) return;
    toast("Post deleted");
    router.push(`/clients/${client!.id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={fromCalendar ? "/calendar" : `/clients/${client.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-soft hover:bg-panel hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fromCalendar ? "Calendar" : client.name}
        </Link>
        <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-ink">
          {post.name || post.caption.slice(0, 40) || "Untitled post"}
        </h2>
        <PostStatusBadge status={post.status} />
        <ApprovalBadge status={post.approvalStatus} />
        {(post.scheduledAt || post.scheduledDay) && (
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {post.scheduledAt
              ? formatDateTime(post.scheduledAt)
              : `Placed on ${dayKeyToNumeric(post.scheduledDay!)}`}
          </span>
        )}
        <div className="ml-auto">
          <Button variant="ghost" onClick={() => setDeleteOpen(true)} aria-label="Delete post">
            <Trash2 className="size-4 text-red-700" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Instagram preview — updates live from the editor draft */}
        <div className="flex min-w-0 justify-center lg:sticky lg:top-24 lg:self-start">
          <PhoneFrame theme={client.theme}>
            <InstagramPostDetail
              post={detail}
              theme={client.theme}
              onBack={() => router.push(fromCalendar ? "/calendar" : `/clients/${client.id}`)}
              onSubmitComment={(text) =>
                void run((repo) =>
                  repo.createComment({
                    postId: post.id,
                    authorName: snapshot.user.displayName,
                    authorEmail: snapshot.user.email,
                    body: text,
                    commentType: "general",
                    resolved: false,
                  }),
                )
              }
            />
          </PhoneFrame>
        </div>

        {/* Direct inline editor — no modal required */}
        <div className="min-w-0 space-y-5">
          <section
            aria-label={post.stage === "content" ? "Create post" : "Edit post"}
            className="min-w-0 rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5"
          >
            <h3 className="mb-4 text-[13.5px] font-semibold tracking-tight text-ink">
              {post.stage === "content" ? "Create post" : "Edit post"}
            </h3>
            {post.stage === "content" && (
              <p className="-mt-3 mb-4 text-[12px] leading-relaxed text-ink-faint">
                This content package isn&apos;t an Instagram post yet — complete the details
                below and choose the publishing time.
              </p>
            )}
            <PostForm
              key={post.id}
              clientId={client.id}
              post={post}
              existingMedia={snapshot.media.filter((m) => m.postId === post.id)}
              clientPosts={snapshot.posts.filter((p) => p.clientId === client.id)}
              variant="inline"
              onSaved={() => setDraft(null)}
              onDraftChange={setDraft}
            />
          </section>

          <ReviewActivity
            post={post}
            comments={comments}
            approvals={snapshot.approvals.filter((a) => a.postId === post.id)}
            ownerEmail={snapshot.user.email}
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Delete this post?"
        body="The post and its media are removed from the grid permanently."
        confirmLabel="Delete post"
        destructive
        busy={deleteBusy}
      />
    </div>
  );
}
