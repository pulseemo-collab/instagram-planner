"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Images as ImagesIcon,
  LayoutGrid,
  List,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { MediaArt } from "@/components/instagram/media-art";
import { PostComposer } from "@/components/posts/post-composer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ApprovalBadge, PostStatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { coverMediaFor, parseMediaRef } from "@/lib/instagram/map-profile";
import { useMutate, useWorkspace } from "@/lib/store/hooks";
import {
  APPROVAL_STATUS_LABELS,
  POST_STATUS_LABELS,
  POST_TYPE_LABELS,
  type ApprovalStatus,
  type Post,
  type PostStatus,
  type PostType,
} from "@/types/domain";

type ViewMode = "grid" | "list";
type DateFilter = "all" | "scheduled_7" | "scheduled_30" | "unscheduled";

export default function ContentPage() {
  const { status, snapshot } = useWorkspace();
  const mutate = useMutate();
  const { toast } = useToast();

  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | PostType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PostStatus>("all");
  const [approvalFilter, setApprovalFilter] = useState<"all" | ApprovalStatus>("all");
  // The reference time is captured when the filter is picked (event handler),
  // keeping the render-phase memo pure.
  const [dateFilter, setDateFilter] = useState<{ kind: DateFilter; asOf: number }>({
    kind: "all",
    asOf: 0,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composerClient, setComposerClient] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const posts = useMemo(() => {
    if (!snapshot) return [];
    const q = query.trim().toLowerCase();
    const now = dateFilter.asOf;
    return snapshot.posts
      .filter((post) => {
        if (clientFilter !== "all" && post.clientId !== clientFilter) return false;
        if (typeFilter !== "all" && post.type !== typeFilter) return false;
        if (statusFilter !== "all" && post.status !== statusFilter) return false;
        if (approvalFilter !== "all" && post.approvalStatus !== approvalFilter) return false;
        if (dateFilter.kind === "unscheduled" && post.scheduledAt) return false;
        if (dateFilter.kind === "scheduled_7" || dateFilter.kind === "scheduled_30") {
          if (!post.scheduledAt) return false;
          const limit = dateFilter.kind === "scheduled_7" ? 7 : 30;
          const time = new Date(post.scheduledAt).getTime();
          if (time < now - 86_400_000 || time > now + limit * 86_400_000) return false;
        }
        if (q) {
          const client = snapshot.clients.find((c) => c.id === post.clientId);
          const haystack = `${post.caption} ${post.hashtags.join(" ")} ${client?.name ?? ""} ${
            client?.instagramUsername ?? ""
          }`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [snapshot, query, clientFilter, typeFilter, statusFilter, approvalFilter, dateFilter]);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  const clientById = new Map(snapshot.clients.map((c) => [c.id, c]));

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkSetApproval(statusValue: ApprovalStatus) {
    setBusy(true);
    try {
      await mutate(async (repo) => {
        for (const id of selected) await repo.updatePost(id, { approvalStatus: statusValue });
      });
      toast(`${selected.size} posts updated`);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    setBusy(true);
    try {
      await mutate(async (repo) => {
        for (const id of selected) await repo.deletePost(id);
      });
      toast(`${selected.size} posts deleted`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const filterSelect =
    "h-9 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] text-ink focus:border-line-strong focus:outline-none";

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-52 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search captions, hashtags, clients…"
            aria-label="Search content"
            className="h-9 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
          />
        </div>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Filter by client" className={filterSelect}>
          <option value="all">All clients</option>
          {snapshot.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} aria-label="Filter by type" className={filterSelect}>
          <option value="all">All types</option>
          {(Object.keys(POST_TYPE_LABELS) as PostType[]).map((key) => (
            <option key={key} value={key}>
              {POST_TYPE_LABELS[key]}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status" className={filterSelect}>
          <option value="all">All statuses</option>
          {(Object.keys(POST_STATUS_LABELS) as PostStatus[]).map((key) => (
            <option key={key} value={key}>
              {POST_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <select value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value as typeof approvalFilter)} aria-label="Filter by approval" className={filterSelect}>
          <option value="all">All approvals</option>
          {(Object.keys(APPROVAL_STATUS_LABELS) as ApprovalStatus[]).map((key) => (
            <option key={key} value={key}>
              {APPROVAL_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <select
          value={dateFilter.kind}
          onChange={(e) => setDateFilter({ kind: e.target.value as DateFilter, asOf: Date.now() })}
          aria-label="Filter by date"
          className={filterSelect}
        >
          <option value="all">Any date</option>
          <option value="scheduled_7">Scheduled · next 7 days</option>
          <option value="scheduled_30">Scheduled · next 30 days</option>
          <option value="unscheduled">Unscheduled</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <div role="radiogroup" aria-label="View" className="flex rounded-lg border border-line bg-panel p-0.5">
            {(
              [
                { id: "grid", icon: LayoutGrid, label: "Grid view" },
                { id: "list", icon: List, label: "List view" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={view === option.id}
                aria-label={option.label}
                onClick={() => setView(option.id)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  view === option.id ? "bg-ink text-panel" : "text-ink-soft hover:text-ink",
                )}
              >
                <option.icon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
          {snapshot.clients.length > 0 && (
            <Button variant="primary" onClick={() => setComposerClient(clientFilter !== "all" ? clientFilter : snapshot.clients[0].id)}>
              <Plus className="size-4" aria-hidden="true" />
              New post
            </Button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 shadow-panel">
          <span className="text-[12.5px] font-medium text-ink">{selected.size} selected</span>
          <Button size="sm" onClick={() => void bulkSetApproval("awaiting_approval")} disabled={busy}>
            Send for approval
          </Button>
          <Button size="sm" onClick={() => void bulkSetApproval("approved")} disabled={busy}>
            Mark approved
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setBulkDeleteOpen(true)} disabled={busy}>
            <Trash2 className="size-3.5 text-red-700" aria-hidden="true" />
            Delete
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[12px] font-medium text-ink-soft hover:text-ink"
          >
            Clear selection
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState
          icon={ImagesIcon}
          title={snapshot.posts.length === 0 ? "No content yet" : "No matches"}
          description={
            snapshot.posts.length === 0
              ? "Create a post from any client workspace, or right here."
              : "No posts match the current filters."
          }
        />
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {posts.map((post) => {
            const client = clientById.get(post.clientId);
            const cover = coverMediaFor(post, snapshot.media);
            const ref = parseMediaRef(cover?.thumbnailUrl ?? cover?.url ?? null);
            const isSelected = selected.has(post.id);
            return (
              <li key={post.id} className="group relative overflow-hidden rounded-xl border border-line bg-panel shadow-panel">
                <Link
                  href={`/clients/${post.clientId}/posts/${post.id}`}
                  className="relative block aspect-[3/4]"
                  aria-label={`Open post for ${client?.name ?? "client"}`}
                >
                  <MediaArt art={ref.art} imageUrl={ref.imageUrl} />
                </Link>
                <label className="absolute left-2 top-2 z-10 flex size-6 cursor-pointer items-center justify-center rounded-md border border-line bg-panel/90 shadow">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(post.id)}
                    aria-label={`Select post from ${client?.name ?? "client"}`}
                    className="size-3.5 accent-ink"
                  />
                </label>
                <div className="space-y-1.5 p-2.5">
                  <p className="truncate text-[12px] font-medium text-ink">
                    {client?.name} · {POST_TYPE_LABELS[post.type]}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <PostStatusBadge status={post.status} />
                    <ApprovalBadge status={post.approvalStatus} />
                  </div>
                  <p className="text-[11px] text-ink-faint">
                    {post.scheduledAt ? formatDateTime(post.scheduledAt) : `Updated ${formatRelative(post.updatedAt)}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-panel">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.06em] text-ink-faint">
                <th className="w-10 px-3 py-2.5">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2.5 font-medium">Post</th>
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Approval</th>
                <th className="px-3 py-2.5 font-medium">Scheduled</th>
                <th className="w-20 px-3 py-2.5 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {posts.map((post) => {
                const client = clientById.get(post.clientId);
                const cover = coverMediaFor(post, snapshot.media);
                const ref = parseMediaRef(cover?.thumbnailUrl ?? cover?.url ?? null);
                return (
                  <tr key={post.id} className="hover:bg-panel-raised">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(post.id)}
                        onChange={() => toggleSelected(post.id)}
                        aria-label={`Select post from ${client?.name ?? "client"}`}
                        className="size-3.5 accent-ink"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/clients/${post.clientId}/posts/${post.id}`} className="flex items-center gap-2.5">
                        <span className="relative block h-10 w-8 shrink-0 overflow-hidden rounded border border-line">
                          <MediaArt art={ref.art} imageUrl={ref.imageUrl} />
                        </span>
                        <span className="line-clamp-1 max-w-52 text-ink">{post.caption || "(no caption)"}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{client?.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{POST_TYPE_LABELS[post.type]}</td>
                    <td className="px-3 py-2">
                      <PostStatusBadge status={post.status} />
                    </td>
                    <td className="px-3 py-2">
                      <ApprovalBadge status={post.approvalStatus} />
                    </td>
                    <td className="px-3 py-2 text-ink-faint">
                      {post.scheduledAt ? formatDateTime(post.scheduledAt) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingPost(post)}
                          className="rounded px-1.5 py-0.5 text-[11.5px] font-medium text-ink-soft hover:bg-canvas hover:text-ink"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(post)}
                          className="rounded px-1.5 py-0.5 text-[11.5px] font-medium text-red-700 hover:bg-canvas"
                        >
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {composerClient && (
        <PostComposer
          open={composerClient !== null}
          onClose={() => setComposerClient(null)}
          clientId={composerClient}
          clientPosts={snapshot.posts.filter((p) => p.clientId === composerClient)}
        />
      )}
      {editingPost && (
        <PostComposer
          open={editingPost !== null}
          onClose={() => setEditingPost(null)}
          clientId={editingPost.clientId}
          post={editingPost}
          existingMedia={snapshot.media.filter((m) => m.postId === editingPost.id)}
          clientPosts={snapshot.posts.filter((p) => p.clientId === editingPost.clientId)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await mutate((repo) => repo.deletePost(deleting.id));
          toast("Post deleted");
          setDeleting(null);
        }}
        title="Delete this post?"
        body="The post and its media are permanently removed."
        confirmLabel="Delete post"
        destructive
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void bulkDelete()}
        title={`Delete ${selected.size} posts?`}
        body="All selected posts and their media are permanently removed."
        confirmLabel="Delete posts"
        destructive
        busy={busy}
      />
    </div>
  );
}
