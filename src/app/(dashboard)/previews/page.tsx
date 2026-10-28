"use client";

import { useState } from "react";
import { Archive, Check, ChevronRight, Copy, ExternalLink, RotateCw, Share2, Trash2 } from "lucide-react";
import { MediaArt } from "@/components/instagram/media-art";
import { shareUrlFor } from "@/components/sharing/share-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/dates";
import { parseMediaRef } from "@/lib/instagram/map-profile";
import type { WorkspaceSnapshot } from "@/lib/repositories/types";
import {
  groupShareLinks,
  shareLinkStatus,
  type PeriodGroup,
  type ShareLinkFilters,
  type ShareLinkStatus,
} from "@/lib/share-links";
import { useAction, useWorkspace } from "@/lib/store/hooks";
import { shareLinkDeleted, shareLinkSaved } from "@/lib/store/patches";
import type { ShareLink } from "@/types/domain";

const STATUS_STYLES: Record<ShareLinkStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  disabled: { label: "Disabled", className: "bg-panel-raised text-ink-soft border-line" },
  expired: { label: "Expired", className: "bg-amber-50 text-amber-800 border-amber-200" },
};

const filterSelect =
  "h-9 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] text-ink focus:border-line-strong focus:outline-none";

export default function PreviewsPage() {
  const { status, snapshot } = useWorkspace();
  const run = useAction();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ShareLinkFilters>({ clientId: "all", status: "all" });
  const [deleting, setDeleting] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  if (snapshot.shareLinks.length === 0) {
    return (
      <EmptyState
        icon={Share2}
        title="No shared previews"
        description="Generate a share link from any client workspace with the Share button — every link you create is managed here."
      />
    );
  }

  const groups = groupShareLinks(snapshot.shareLinks, snapshot.clients, filters);
  const clientsWithLinks = snapshot.clients
    .filter((c) => snapshot.shareLinks.some((l) => l.clientId === c.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const filtered = filters.clientId !== "all" || filters.status !== "all";

  async function copy(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(shareUrlFor(link.token));
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast("Could not copy the link", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    setBusy(true);
    const result = await run((repo) => repo.deleteShareLink(id), shareLinkDeleted(id));
    setBusy(false);
    setDeleting(null);
    if (result.ok) toast("Link deleted — its URL no longer works");
  }

  const card = (link: ShareLink) => (
    <LinkCard
      key={link.id}
      link={link}
      snapshot={snapshot}
      copied={copiedId === link.id}
      onCopy={() => void copy(link)}
      onToggle={async () => {
        const result = await run(
          (repo) => repo.updateShareLink(link.id, { isActive: !link.isActive }),
          shareLinkSaved,
        );
        if (result.ok) toast(link.isActive ? "Link disabled" : "Link enabled");
      }}
      onRegenerate={async () => {
        const result = await run((repo) => repo.regenerateShareToken(link.id), shareLinkSaved);
        if (result.ok) toast("Token regenerated — the old URL stopped working");
      }}
      onDelete={() => setDeleting(link)}
    />
  );

  const periods = (list: PeriodGroup[], level: "current" | "archive") =>
    list.map((period) => (
      <div key={period.key} className="space-y-2">
        <h3
          className={
            level === "current"
              ? "text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint"
              : "text-[11px] font-medium uppercase tracking-wide text-ink-faint"
          }
        >
          {period.label}
        </h3>
        {period.links.map(card)}
      </div>
    ));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.clientId}
          onChange={(e) => setFilters((f) => ({ ...f, clientId: e.target.value }))}
          aria-label="Filter by client"
          className={filterSelect}
        >
          <option value="all">All clients</option>
          {clientsWithLinks.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value as ShareLinkFilters["status"] }))
          }
          aria-label="Filter by status"
          className={filterSelect}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="expired">Expired</option>
        </select>
        {filtered && (
          <Button size="sm" variant="ghost" onClick={() => setFilters({ clientId: "all", status: "all" })}>
            Clear filters
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-soft">
          No links match these filters.
        </p>
      ) : (
        groups.map(({ client, current, archive }) => {
          const avatarRef = parseMediaRef(client.avatarUrl);
          const archived = archive.reduce((n, p) => n + p.links.length, 0);
          const headingId = `previews-client-${client.id}`;
          return (
            <section key={client.id} aria-labelledby={headingId} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="relative block size-8 shrink-0 overflow-hidden rounded-full border border-line">
                  <MediaArt art={avatarRef.art} imageUrl={avatarRef.imageUrl} alt="" />
                </span>
                <h2 id={headingId} className="truncate text-[15px] font-semibold tracking-tight text-ink">
                  {client.name}
                </h2>
              </div>

              {current.length > 0 ? (
                periods(current, "current")
              ) : (
                <p className="text-[12.5px] text-ink-faint">No active links.</p>
              )}

              {archived > 0 && (
                <details className="group rounded-xl border border-line bg-panel-raised/50">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      className="size-3.5 transition-transform group-open:rotate-90"
                      aria-hidden="true"
                    />
                    <Archive className="size-3.5" aria-hidden="true" />
                    Archive ({archived})
                    <span className="font-normal text-ink-faint">· disabled and expired links</span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3">{periods(archive, "archive")}</div>
                </details>
              )}
            </section>
          );
        })
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete this link?"
        body="The link is removed for the whole team and its URL stops working immediately. Comments and approvals it collected stay on the posts."
        confirmLabel="Delete link"
        destructive
        busy={busy}
      />
    </div>
  );
}

function LinkCard({
  link,
  snapshot,
  copied,
  onCopy,
  onToggle,
  onRegenerate,
  onDelete,
}: {
  link: ShareLink;
  snapshot: WorkspaceSnapshot;
  copied: boolean;
  onCopy: () => void;
  onToggle: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const clientPosts = snapshot.posts.filter((p) => p.clientId === link.clientId);
  const postIds = new Set(clientPosts.map((p) => p.id));
  const commentCount = snapshot.comments.filter((c) => postIds.has(c.postId)).length;
  const approvedCount = clientPosts.filter((p) => p.approvalStatus === "approved").length;
  const state = STATUS_STYLES[shareLinkStatus(link)];

  return (
    <div
      data-testid="share-link-card"
      className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <code className="block min-w-0 flex-1 truncate font-mono text-[12px] text-ink-soft">
          /share/{link.token}
        </code>
        <span
          className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${state.className}`}
        >
          {state.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-soft">
        <span>Created {formatDate(link.createdAt)}</span>
        <span>{link.expiresAt ? `Expires ${formatDate(link.expiresAt)}` : "No expiration"}</span>
        <span>
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
        </span>
        <span>
          {approvedCount}/{clientPosts.length} approved
        </span>
        <span className="hidden sm:inline">
          {link.allowComments ? "Comments on" : "Comments off"} ·{" "}
          {link.allowApproval ? "Approvals on" : "Approvals off"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <Button size="sm" onClick={onCopy}>
          {copied ? (
            <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          Copy link
        </Button>
        <a
          href={shareUrlFor(link.token)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[12.5px] font-medium text-ink hover:border-line-strong"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Open preview
        </a>
        <Button size="sm" onClick={onToggle}>
          {link.isActive ? "Disable" : "Enable"}
        </Button>
        <Button size="sm" onClick={onRegenerate}>
          <RotateCw className="size-3.5" aria-hidden="true" />
          Regenerate token
        </Button>
        <Button size="sm" onClick={onDelete} className="sm:ml-auto">
          <Trash2 className="size-3.5 text-red-700" aria-hidden="true" />
          Delete link
        </Button>
      </div>
    </div>
  );
}
