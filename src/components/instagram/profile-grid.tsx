"use client";

import { useState } from "react";
import { formatCount } from "@/lib/instagram/format";
import type { IgMedia, IgTabId } from "@/lib/instagram/types";
import { CarouselFilledIcon, PinFilledIcon, PlayFilledIcon, ReelsFilledIcon } from "./icons";
import { MediaArt } from "./media-art";

export interface GridEditing {
  /** Called with the full ordered id list after a drop or keyboard move. */
  onReorder: (orderedIds: string[]) => void;
}

export interface ProfileGridProps {
  media: IgMedia[];
  tab: IgTabId;
  /** Opens the post detail. */
  onOpen?: (postId: string) => void;
  /** Present only in workspace edit mode — enables drag/keyboard reordering. */
  editing?: GridEditing;
}

function TileBadge({ item }: { item: IgMedia }) {
  if (item.isPinned) {
    return <PinFilledIcon size={18} />;
  }
  if (item.kind === "carousel") {
    return <CarouselFilledIcon size={17} />;
  }
  if (item.kind === "reel") {
    return <ReelsFilledIcon size={17} />;
  }
  return null;
}

function moveId(ids: string[], from: number, to: number): string[] {
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ProfileGrid({ media, tab, onOpen, editing }: ProfileGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (media.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center px-6 text-center text-[14px] text-(--ig-text-secondary)">
        {tab === "posts" ? "No posts yet" : "No content yet"}
      </div>
    );
  }

  const ids = media.map((m) => m.id);

  function commitMove(from: number, to: number) {
    if (!editing || from === to || to < 0 || to >= ids.length) return;
    editing.onReorder(moveId(ids, from, to));
  }

  return (
    <div className="grid grid-cols-3 gap-[2px]">
      {media.map((item, index) => {
        const aspect = tab === "reels" ? "aspect-[9/16]" : "aspect-[3/4]";
        const badge = <TileBadge item={item} />;
        const isDropTarget = editing && overIndex === index && dragIndex !== null && dragIndex !== index;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen?.(item.id)}
            aria-label={
              editing
                ? `Post ${index + 1} of ${ids.length}. Enter to open. Use Ctrl+Arrow keys to reorder.`
                : item.kind === "reel"
                  ? "Open reel"
                  : "Open post"
            }
            draggable={Boolean(editing)}
            onDragStart={(e) => {
              if (!editing) return;
              setDragIndex(index);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", item.id);
            }}
            onDragOver={(e) => {
              if (!editing || dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverIndex(index);
            }}
            onDragLeave={() => {
              if (overIndex === index) setOverIndex(null);
            }}
            onDrop={(e) => {
              if (!editing || dragIndex === null) return;
              e.preventDefault();
              commitMove(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onKeyDown={(e) => {
              if (!editing || !(e.ctrlKey || e.metaKey)) return;
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                commitMove(index, index - 1);
              } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                commitMove(index, index + 1);
              }
            }}
            className={`relative overflow-hidden bg-(--ig-button) ${aspect} ${
              editing ? "cursor-grab focus-visible:z-10 active:cursor-grabbing" : ""
            } ${isDropTarget ? "opacity-60 ring-2 ring-inset ring-(--ig-blue)" : ""} ${
              dragIndex === index ? "opacity-40" : ""
            }`}
          >
            <MediaArt art={item.placeholder} imageUrl={item.imageUrl} />

            {badge && tab !== "reels" && (
              <span className="absolute right-1.5 top-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                {badge}
              </span>
            )}

            {tab === "reels" && item.viewCount !== undefined && (
              <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                <PlayFilledIcon size={12} />
                <span className="text-[13px] font-medium leading-none">
                  {formatCount(item.viewCount)}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
