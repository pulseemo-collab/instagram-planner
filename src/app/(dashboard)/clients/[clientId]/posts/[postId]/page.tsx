"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Check, Images, Pencil, Trash2 } from "lucide-react";
import { InstagramPostDetail } from "@/components/instagram/post-detail";
import { PhoneFrame } from "@/components/preview/phone-frame";
import { PostComposer } from "@/components/posts/post-composer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ApprovalBadge, PostStatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { buildIgPostDetail } from "@/lib/instagram/map-post";
import { useMutate, useWorkspace } from "@/lib/store/hooks";

export default function PostDetailPage() {
  const params = useParams<{ clientId: string; postId: string }>();
  const router = useRouter();
  const { status, snapshot } = useWorkspace();
  const mutate = useMutate();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
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

  const detail = useMemo(() => {
    if (!client || !post || !snapshot) return null;
    return buildIgPostDetail(client, post, snapshot.media, comments);
  }, [client, post, snapshot, comments]);

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
    try {
      await mutate((repo) => repo.deletePost(post!.id));
      toast("Post deleted");
      router.push(`/clients/${client!.id}`);
    } finally {
      setDeleteBusy(false);
    }
  }

  const unresolved = comments.filter((c) => !c.resolved);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-soft hover:bg-panel hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {client.name}
        </Link>
        <PostStatusBadge status={post.status} />
        <ApprovalBadge status={post.approvalStatus} />
        {post.scheduledAt && (
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {formatDateTime(post.scheduledAt)}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit post
          </Button>
          <Button variant="ghost" onClick={() => setDeleteOpen(true)} aria-label="Delete post">
            <Trash2 className="size-4 text-red-700" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex justify-center lg:sticky lg:top-24 lg:self-start">
          <PhoneFrame theme={client.theme}>
            <InstagramPostDetail
              post={detail}
              theme={client.theme}
              onBack={() => router.push(`/clients/${client.id}`)}
              onSubmitComment={(text) =>
                void mutate((repo) =>
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

        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
            <h3 className="text-[13.5px] font-semibold tracking-tight text-ink">
              Feedback{unresolved.length > 0 && ` · ${unresolved.length} open`}
            </h3>
            {comments.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-ink-faint">
                No comments yet. Reviewer feedback from share links appears here.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg border border-line bg-panel-raised p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-ink">{comment.authorName}</span>
                      {comment.commentType === "change_request" && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent-deep">
                          Change request
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-ink-faint">
                        {formatRelative(comment.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink">{comment.body}</p>
                    <button
                      type="button"
                      onClick={() =>
                        void mutate((repo) => repo.setCommentResolved(comment.id, !comment.resolved))
                      }
                      className={`mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium ${
                        comment.resolved ? "text-emerald-700" : "text-ink-soft hover:text-ink"
                      }`}
                    >
                      <Check className="size-3" aria-hidden="true" />
                      {comment.resolved ? "Resolved" : "Mark resolved"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
            <h3 className="text-[13.5px] font-semibold tracking-tight text-ink">Approval</h3>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              Update the state after acting on feedback, or resubmit for review.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await mutate((repo) => repo.updatePost(post.id, { approvalStatus: "awaiting_approval" }));
                  toast("Marked as awaiting approval");
                }}
                disabled={post.approvalStatus === "awaiting_approval"}
              >
                Send for approval
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await mutate((repo) => repo.updatePost(post.id, { approvalStatus: "approved" }));
                  toast("Marked approved");
                }}
                disabled={post.approvalStatus === "approved"}
              >
                Mark approved
              </Button>
            </div>
          </section>
        </div>
      </div>

      <PostComposer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        clientId={client.id}
        post={post}
        existingMedia={snapshot.media.filter((m) => m.postId === post.id)}
        clientPosts={snapshot.posts.filter((p) => p.clientId === client.id)}
      />
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
