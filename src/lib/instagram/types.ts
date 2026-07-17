export type IgTheme = "light" | "dark";

export type IgTabId = "posts" | "reels" | "reposts" | "tagged";

export type IgMediaKind = "image" | "carousel" | "reel";

/**
 * Gradient stand-in rendered while a real image is absent. Once uploads land,
 * `imageUrl` on the owning entity takes precedence and this is ignored.
 */
export interface IgPlaceholderArt {
  from: string;
  via: string;
  to: string;
  /** Gradient angle in degrees. Defaults to 150. */
  angle?: number;
}

export interface IgMedia {
  id: string;
  kind: IgMediaKind;
  isPinned?: boolean;
  /** Reel play count, shown on the Reels tab. */
  viewCount?: number;
  imageUrl?: string;
  placeholder: IgPlaceholderArt;
}

export interface IgHighlight {
  id: string;
  label: string;
  imageUrl?: string;
  cover: IgPlaceholderArt;
}

export interface IgAvatar {
  imageUrl?: string;
  placeholder: IgPlaceholderArt;
}

export interface IgProfile {
  username: string;
  fullName: string;
  isVerified: boolean;
  isPrivate: boolean;
  category?: string;
  /** Short note shown as a bubble above the avatar. */
  note?: string;
  /** Renders the Threads badge chip when present. */
  threadsUsername?: string;
  bioLines: string[];
  website?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  hasActiveStory: boolean;
  avatar: IgAvatar;
  highlights: IgHighlight[];
  posts: IgMedia[];
  reels: IgMedia[];
  reposts: IgMedia[];
  tagged: IgMedia[];
}
