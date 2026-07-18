import type { Client, Highlight, Post, PostMedia } from "@/types/domain";
import type { IgHighlight, IgMedia, IgPlaceholderArt, IgProfile } from "./types";

const FALLBACK_ART: IgPlaceholderArt = { from: "#e8e4dc", via: "#c9c3b6", to: "#8d867a", angle: 150 };

/** Parse `gradient:from/via/to/angle` placeholder URIs used by seed data. */
export function parseMediaRef(url: string | null): { imageUrl?: string; art: IgPlaceholderArt } {
  if (!url) return { art: FALLBACK_ART };
  if (url.startsWith("gradient:")) {
    const [from, via, to, angle] = url.slice("gradient:".length).split("/");
    if (from && via && to) {
      return { art: { from, via, to, angle: Number(angle) || 150 } };
    }
    return { art: FALLBACK_ART };
  }
  // Demo-mode storage references are not directly displayable — the workspace
  // store resolves them to data URLs before they reach the UI. If one slips
  // through (e.g. a just-uploaded draft), fall back to placeholder art rather
  // than a broken <img>.
  if (url.startsWith("local:")) return { art: FALLBACK_ART };
  return { imageUrl: url, art: FALLBACK_ART };
}

/** Instagram-like ordering: pinned first (stable), then grid position. */
export function sortForGrid(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.gridPosition - b.gridPosition;
  });
}

export function coverMediaFor(post: Post, media: PostMedia[]): PostMedia | undefined {
  const own = media
    .filter((m) => m.postId === post.id)
    .sort((a, b) => a.position - b.position);
  return own[0];
}

function toIgMedia(post: Post, media: PostMedia[]): IgMedia {
  const cover = coverMediaFor(post, media);
  const ref = parseMediaRef(cover?.thumbnailUrl ?? cover?.url ?? null);
  return {
    id: post.id,
    kind: post.type,
    isPinned: post.isPinned,
    viewCount: post.type === "reel" ? post.likesCount * 4 + 1200 : undefined,
    imageUrl: ref.imageUrl,
    placeholder: ref.art,
  };
}

function toIgHighlight(highlight: Highlight): IgHighlight {
  const ref = parseMediaRef(highlight.coverUrl);
  return {
    id: highlight.id,
    label: highlight.title,
    imageUrl: ref.imageUrl,
    cover: ref.art,
  };
}

/**
 * Builds the Instagram view model from domain entities. This is the single
 * bridge between application data and the reusable Instagram components.
 */
export function buildIgProfile(
  client: Client,
  highlights: Highlight[],
  posts: Post[],
  media: PostMedia[],
): IgProfile {
  // Designer content packages are not Instagram posts yet — only completed
  // posts render on the profile grid.
  const ordered = sortForGrid(posts.filter((p) => p.stage === "post"));
  const avatarRef = parseMediaRef(client.avatarUrl);
  return {
    username: client.instagramUsername,
    fullName: client.profileName || client.name,
    isVerified: client.isVerified,
    isPrivate: client.isPrivate,
    category: client.category ?? undefined,
    note: client.note ?? undefined,
    threadsUsername: client.threadsUsername ?? undefined,
    bioLines: client.bio ? client.bio.split("\n").filter(Boolean) : [],
    website: client.website ?? undefined,
    postCount: client.postsCount,
    followerCount: client.followersCount,
    followingCount: client.followingCount,
    hasActiveStory: highlights.length > 0,
    avatar: { imageUrl: avatarRef.imageUrl, placeholder: avatarRef.art },
    highlights: [...highlights].sort((a, b) => a.position - b.position).map(toIgHighlight),
    posts: ordered.map((p) => toIgMedia(p, media)),
    reels: ordered.filter((p) => p.type === "reel").map((p) => toIgMedia(p, media)),
    reposts: [],
    tagged: [],
  };
}
