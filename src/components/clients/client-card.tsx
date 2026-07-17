"use client";

import Link from "next/link";
import { Clock3, Images } from "lucide-react";
import { MediaArt } from "@/components/instagram/media-art";
import { ApprovalBadge } from "@/components/ui/status-badge";
import { clientApprovalRollup } from "@/lib/derive";
import { formatRelative } from "@/lib/dates";
import { coverMediaFor, parseMediaRef, sortForGrid } from "@/lib/instagram/map-profile";
import type { Client, Post, PostMedia } from "@/types/domain";
import type { ReactNode } from "react";

interface ClientCardProps {
  client: Client;
  posts: Post[];
  media: PostMedia[];
  /** Optional actions menu rendered in the header (stops link navigation). */
  menu?: ReactNode;
}

/** Client overview card with a real miniature grid, linking to the workspace. */
export function ClientCard({ client, posts, media, menu }: ClientCardProps) {
  const ordered = sortForGrid(posts).slice(0, 6);
  const avatarRef = parseMediaRef(client.avatarUrl);
  const rollup = clientApprovalRollup(posts);

  return (
    <div className="group relative rounded-xl border border-line bg-panel p-4 shadow-panel transition-shadow duration-200 hover:shadow-panel-hover sm:p-5">
      <Link
        href={`/clients/${client.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`Open workspace for ${client.name}`}
      />
      <div className="pointer-events-none flex items-center gap-3">
        <span className="relative block size-10 shrink-0 overflow-hidden rounded-full border border-line">
          <MediaArt art={avatarRef.art} imageUrl={avatarRef.imageUrl} alt="" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold tracking-tight text-ink">{client.name}</p>
          <p className="truncate text-[12.5px] text-ink-faint">@{client.instagramUsername}</p>
        </div>
        {menu && <span className="pointer-events-auto relative z-10">{menu}</span>}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line"
      >
        {ordered.length > 0
          ? ordered.map((post) => {
              const cover = coverMediaFor(post, media);
              const ref = parseMediaRef(cover?.thumbnailUrl ?? cover?.url ?? null);
              return (
                <span key={post.id} className="relative block aspect-square overflow-hidden">
                  <MediaArt art={ref.art} imageUrl={ref.imageUrl} />
                </span>
              );
            })
          : Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="block aspect-square bg-panel-raised" />
            ))}
      </div>

      <div className="pointer-events-none mt-4 flex items-center justify-between gap-3 text-[12.5px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Images className="size-3.5 text-ink-faint" aria-hidden="true" />
          {posts.length} {posts.length === 1 ? "post" : "posts"} prepared
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-faint">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {formatRelative(client.updatedAt)}
        </span>
      </div>

      <div className="pointer-events-none mt-3 border-t border-line pt-3">
        <ApprovalBadge status={rollup} />
      </div>
    </div>
  );
}
