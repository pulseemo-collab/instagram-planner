"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, RotateCw, Share2 } from "lucide-react";
import { MediaArt } from "@/components/instagram/media-art";
import { shareUrlFor } from "@/components/sharing/share-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/dates";
import { parseMediaRef } from "@/lib/instagram/map-profile";
import { useAction, useWorkspace } from "@/lib/store/hooks";
import { shareLinkSaved } from "@/lib/store/patches";
import type { ShareLink } from "@/types/domain";

function linkState(link: ShareLink): { label: string; className: string } {
  if (!link.isActive) return { label: "Disabled", className: "bg-panel-raised text-ink-soft border-line" };
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now())
    return { label: "Expired", className: "bg-amber-50 text-amber-800 border-amber-200" };
  return { label: "Active", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
}

export default function PreviewsPage() {
  const { status, snapshot } = useWorkspace();
  const run = useAction();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  const links = [...snapshot.shareLinks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (links.length === 0) {
    return (
      <EmptyState
        icon={Share2}
        title="No shared previews"
        description="Generate a share link from any client workspace with the Share button — every link you create is managed here."
      />
    );
  }

  async function copy(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(shareUrlFor(link.token));
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast("Could not copy the link", "error");
    }
  }

  return (
    <div className="space-y-3">
      {links.map((link) => {
        const client = snapshot.clients.find((c) => c.id === link.clientId);
        if (!client) return null;
        const clientPosts = snapshot.posts.filter((p) => p.clientId === link.clientId);
        const postIds = new Set(clientPosts.map((p) => p.id));
        const commentCount = snapshot.comments.filter((c) => postIds.has(c.postId)).length;
        const approvedCount = clientPosts.filter((p) => p.approvalStatus === "approved").length;
        const avatarRef = parseMediaRef(client.avatarUrl);
        const state = linkState(link);

        return (
          <div key={link.id} className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="relative block size-10 shrink-0 overflow-hidden rounded-full border border-line">
                <MediaArt art={avatarRef.art} imageUrl={avatarRef.imageUrl} alt="" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold tracking-tight text-ink">{client.name}</p>
                <code className="block truncate font-mono text-[11.5px] text-ink-faint">
                  /share/{link.token}
                </code>
              </div>
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
              <Button size="sm" onClick={() => void copy(link)}>
                {copiedId === link.id ? (
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
              <Button
                size="sm"
                onClick={async () => {
                  const result = await run(
                    (repo) => repo.updateShareLink(link.id, { isActive: !link.isActive }),
                    shareLinkSaved,
                  );
                  if (result.ok) toast(link.isActive ? "Link disabled" : "Link enabled");
                }}
              >
                {link.isActive ? "Disable" : "Enable"}
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const result = await run((repo) => repo.regenerateShareToken(link.id), shareLinkSaved);
                  if (result.ok) toast("Token regenerated — the old URL stopped working");
                }}
              >
                <RotateCw className="size-3.5" aria-hidden="true" />
                Regenerate token
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
