"use client";

import { useState } from "react";
import { formatCount } from "@/lib/instagram/format";
import type { IgPostDetail } from "@/lib/instagram/map-post";
import type { IgAvatar, IgTheme } from "@/lib/instagram/types";
import { BottomNavigation } from "./bottom-navigation";
import {
  BookmarkIcon,
  ChevronLeftIcon,
  CommentIcon,
  EllipsisIcon,
  HeartIcon,
  PlayFilledIcon,
  ShareIcon,
  VerifiedIcon,
} from "./icons";
import { MediaArt } from "./media-art";

/* ------------------------------ subcomponents ---------------------------- */

export function PostTopBar({ username, onBack }: { username: string; onBack?: () => void }) {
  return (
    <div className="relative flex h-[44px] items-center justify-center bg-(--ig-bg) px-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="absolute left-2 flex size-9 items-center justify-center text-(--ig-text)"
      >
        <ChevronLeftIcon size={24} />
      </button>
      <div className="text-center leading-tight">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-(--ig-text-secondary)">
          {username}
        </p>
        <p className="text-[15px] font-bold text-(--ig-text)">Posts</p>
      </div>
    </div>
  );
}

export function PostAuthor({
  post,
}: {
  post: Pick<IgPostDetail, "username" | "isVerified" | "avatarImageUrl" | "avatarArt" | "location">;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="relative block size-8 shrink-0 overflow-hidden rounded-full">
        <MediaArt art={post.avatarArt} imageUrl={post.avatarImageUrl} alt="" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="flex items-center gap-1 text-[13px] font-semibold text-(--ig-text)">
          {post.username}
          {post.isVerified && <VerifiedIcon size={12} className="shrink-0" />}
        </p>
        {post.location && (
          <p className="truncate text-[11.5px] text-(--ig-text)">{post.location}</p>
        )}
      </div>
      <button type="button" aria-label="Post options" className="p-1 text-(--ig-text)">
        <EllipsisIcon size={20} />
      </button>
    </div>
  );
}

export function CarouselControls({
  count,
  index,
  onChange,
}: {
  count: number;
  index: number;
  onChange: (index: number) => void;
}) {
  if (count <= 1) return null;
  return (
    <div className="flex justify-center gap-[5px] pt-3" role="tablist" aria-label="Carousel position">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === index}
          aria-label={`Slide ${i + 1}`}
          onClick={() => onChange(i)}
          className={`size-[6px] rounded-full transition-colors ${
            i === index ? "bg-(--ig-blue)" : "bg-(--ig-highlight-ring)"
          }`}
        />
      ))}
    </div>
  );
}

export function PostMediaViewer({
  post,
  index,
  onIndexChange,
}: {
  post: Pick<IgPostDetail, "media" | "type">;
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const item = post.media[Math.min(index, post.media.length - 1)];
  const isReel = post.type === "reel";

  return (
    <div className={`relative w-full overflow-hidden bg-(--ig-button) ${isReel ? "aspect-[4/5]" : "aspect-[4/5]"}`}>
      {item.videoUrl ? (
        <video
          key={item.id}
          src={item.videoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          controls
          playsInline
          loop
          muted
        />
      ) : (
        <MediaArt art={item.art} imageUrl={item.imageUrl} alt="" />
      )}

      {isReel && !item.videoUrl && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-black/45 text-white">
            <PlayFilledIcon size={26} />
          </span>
        </span>
      )}

      {post.media.length > 1 && (
        <>
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/65 px-2 py-0.5 text-[11.5px] font-medium text-white">
            {index + 1}/{post.media.length}
          </span>
          {index > 0 && (
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => onIndexChange(index - 1)}
              className="absolute left-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black/70 shadow"
            >
              <ChevronLeftIcon size={16} />
            </button>
          )}
          {index < post.media.length - 1 && (
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => onIndexChange(index + 1)}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black/70 shadow"
            >
              <ChevronLeftIcon size={16} className="rotate-180" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function PostActions({
  liked,
  saved,
  onToggleLike,
  onToggleSave,
  onComment,
}: {
  liked: boolean;
  saved: boolean;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onComment?: () => void;
}) {
  return (
    <div className="flex items-center px-3 pt-1.5">
      <div className="flex items-center gap-4">
        <button type="button" aria-label={liked ? "Unlike" : "Like"} aria-pressed={liked} onClick={onToggleLike} className="text-(--ig-text)">
          <HeartIcon size={24} filled={liked} />
        </button>
        <button type="button" aria-label="Comment" onClick={onComment} className="text-(--ig-text)">
          <CommentIcon size={24} />
        </button>
        <button type="button" aria-label="Share" className="text-(--ig-text)">
          <ShareIcon size={24} />
        </button>
      </div>
      <button
        type="button"
        aria-label={saved ? "Remove from saved" : "Save"}
        aria-pressed={saved}
        onClick={onToggleSave}
        className="ml-auto text-(--ig-text)"
      >
        <BookmarkIcon size={24} />
      </button>
    </div>
  );
}

export function LikesSummary({ likesCount, liked }: { likesCount: number; liked: boolean }) {
  const total = likesCount + (liked ? 1 : 0);
  if (total === 0) return null;
  return (
    <p className="px-3 pt-2 text-[13px] font-semibold text-(--ig-text)">
      {formatCount(total)} likes
    </p>
  );
}

export function PostCaption({
  post,
}: {
  post: Pick<IgPostDetail, "username" | "caption" | "hashtags">;
}) {
  if (!post.caption && post.hashtags.length === 0) return null;
  return (
    <p className="px-3 pt-1 text-[13px] leading-[17px] text-(--ig-text)">
      <span className="font-semibold">{post.username}</span>{" "}
      {post.caption}
      {post.hashtags.length > 0 && (
        <>
          {" "}
          <span className="text-(--ig-link)">{post.hashtags.map((t) => `#${t}`).join(" ")}</span>
        </>
      )}
    </p>
  );
}

export function CommentPreview({
  post,
}: {
  post: Pick<IgPostDetail, "commentsCount" | "comments">;
}) {
  if (post.commentsCount === 0) return null;
  return (
    <div className="space-y-0.5 px-3 pt-1">
      {post.commentsCount > post.comments.length && (
        <button type="button" className="text-[13px] text-(--ig-text-secondary)">
          View all {post.commentsCount} comments
        </button>
      )}
      {post.comments.map((comment) => (
        <p key={comment.id} className="text-[13px] leading-[17px] text-(--ig-text)">
          <span className="font-semibold">{comment.authorName.split(" ")[0].toLowerCase()}</span>{" "}
          {comment.body}
        </p>
      ))}
    </div>
  );
}

export function PostTimestamp({ label }: { label: string }) {
  return <p className="px-3 pt-1.5 text-[11px] uppercase tracking-[0.02em] text-(--ig-text-secondary)">{label}</p>;
}

export function AddComment({
  avatar,
  onSubmit,
}: {
  avatar: IgAvatar;
  onSubmit?: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex items-center gap-2.5 px-3 pb-2 pt-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) {
          onSubmit?.(text.trim());
          setText("");
        }
      }}
    >
      <span className="relative block size-7 shrink-0 overflow-hidden rounded-full">
        <MediaArt art={avatar.placeholder} imageUrl={avatar.imageUrl} alt="" />
      </span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment…"
        aria-label="Add a comment"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-(--ig-text) placeholder:text-(--ig-text-secondary) focus:outline-none"
      />
      {text.trim() && (
        <button type="submit" className="text-[13px] font-semibold text-(--ig-blue)">
          Post
        </button>
      )}
    </form>
  );
}

/* ------------------------------ composition ------------------------------ */

export interface InstagramPostDetailProps {
  post: IgPostDetail;
  theme?: IgTheme;
  onBack?: () => void;
  /** Viewer avatar for the add-comment row. */
  viewerAvatar?: IgAvatar;
  onSubmitComment?: (text: string) => void;
  className?: string;
}

/** Instagram mobile post-detail screen (single image, carousel, reel). */
export function InstagramPostDetail({
  post,
  theme = "light",
  onBack,
  viewerAvatar,
  onSubmitComment,
  className,
}: InstagramPostDetailProps) {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const avatar: IgAvatar = viewerAvatar ?? {
    imageUrl: post.avatarImageUrl,
    placeholder: post.avatarArt,
  };

  return (
    <div
      className={`ig-root ${theme === "dark" ? "ig-dark" : "ig-light"} flex h-full flex-col bg-(--ig-bg) ${className ?? ""}`}
    >
      <PostTopBar username={post.username} onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PostAuthor post={post} />
        <PostMediaViewer post={post} index={mediaIndex} onIndexChange={setMediaIndex} />
        <CarouselControls count={post.media.length} index={mediaIndex} onChange={setMediaIndex} />
        <PostActions
          liked={liked}
          saved={saved}
          onToggleLike={() => setLiked((v) => !v)}
          onToggleSave={() => setSaved((v) => !v)}
        />
        <LikesSummary likesCount={post.likesCount} liked={liked} />
        <PostCaption post={post} />
        <CommentPreview post={post} />
        <PostTimestamp label={post.timestampLabel} />
        <AddComment avatar={avatar} onSubmit={onSubmitComment} />
      </div>
      <BottomNavigation avatar={avatar} active="home" />
    </div>
  );
}
