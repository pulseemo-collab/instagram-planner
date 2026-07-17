import { formatShortDate } from "@/lib/dates";
import type { Client, Comment, Post, PostMedia } from "@/types/domain";
import { parseMediaRef } from "./map-profile";
import type { IgPlaceholderArt } from "./types";

export interface IgPostMediaItem {
  id: string;
  mediaType: "image" | "video";
  imageUrl?: string;
  videoUrl?: string;
  art: IgPlaceholderArt;
}

export interface IgPostComment {
  id: string;
  authorName: string;
  body: string;
  isChangeRequest: boolean;
}

/** View model consumed by <InstagramPostDetail>. */
export interface IgPostDetail {
  id: string;
  username: string;
  isVerified: boolean;
  avatarImageUrl?: string;
  avatarArt: IgPlaceholderArt;
  location?: string;
  type: Post["type"];
  media: IgPostMediaItem[];
  likesCount: number;
  caption: string;
  hashtags: string[];
  commentsCount: number;
  comments: IgPostComment[];
  /** e.g. "Jun 12" or "Scheduled for Jul 18" */
  timestampLabel: string;
}

export function buildIgPostDetail(
  client: Client,
  post: Post,
  media: PostMedia[],
  comments: Comment[],
): IgPostDetail {
  const avatarRef = parseMediaRef(client.avatarUrl);
  const ownMedia = media
    .filter((m) => m.postId === post.id)
    .sort((a, b) => a.position - b.position);

  const items: IgPostMediaItem[] = ownMedia.map((m) => {
    const ref = parseMediaRef(m.url);
    const isRealVideo = m.mediaType === "video" && !m.url.startsWith("gradient:");
    return {
      id: m.id,
      mediaType: m.mediaType,
      imageUrl: isRealVideo ? undefined : ref.imageUrl,
      videoUrl: isRealVideo ? m.url : undefined,
      art: parseMediaRef(m.thumbnailUrl ?? m.url).art,
    };
  });

  const timestampLabel = post.publishedAt
    ? formatShortDate(post.publishedAt)
    : post.scheduledAt
      ? `Scheduled for ${formatShortDate(post.scheduledAt)}`
      : "Draft";

  return {
    id: post.id,
    username: client.instagramUsername,
    isVerified: client.isVerified,
    avatarImageUrl: avatarRef.imageUrl,
    avatarArt: avatarRef.art,
    location: post.location ?? undefined,
    type: post.type,
    media: items.length ? items : [{ id: "empty", mediaType: "image", art: parseMediaRef(null).art }],
    likesCount: post.likesCount,
    caption: post.caption,
    hashtags: post.hashtags,
    commentsCount: comments.length,
    comments: comments.slice(0, 2).map((c) => ({
      id: c.id,
      authorName: c.authorName,
      body: c.body,
      isChangeRequest: c.commentType === "change_request",
    })),
    timestampLabel,
  };
}
