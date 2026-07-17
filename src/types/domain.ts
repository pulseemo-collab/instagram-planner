/**
 * Domain model shared by every persistence backend (demo IndexedDB and
 * Supabase). All timestamps are ISO 8601 strings; `scheduledAt` is stored as
 * an ISO string produced from the user's local wall-clock time.
 */

export type PostType = "image" | "carousel" | "reel";
export type PostStatus = "draft" | "scheduled" | "published";
export type ApprovalStatus =
  | "not_sent"
  | "awaiting_approval"
  | "approved"
  | "changes_requested";
export type Theme = "light" | "dark";
export type AccountType = "personal" | "creator" | "business";
export type MediaType = "image" | "video";
export type CommentType = "general" | "change_request";
export type ActivityType =
  | "client_created"
  | "client_updated"
  | "post_created"
  | "post_updated"
  | "post_scheduled"
  | "highlight_created"
  | "share_link_created"
  | "comment_received"
  | "approval_received"
  | "changes_requested";

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  instagramUsername: string;
  profileName: string;
  /** `null`, an uploaded media reference, or a `gradient:` placeholder URI. */
  avatarUrl: string | null;
  category: string | null;
  bio: string;
  website: string | null;
  threadsUsername: string | null;
  /** Short profile note shown as the bubble above the avatar. */
  note: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  accountType: AccountType;
  /** Vanity counts shown on the profile (independent of planned posts). */
  postsCount: number;
  followersCount: number;
  followingCount: number;
  theme: Theme;
  createdAt: string;
  updatedAt: string;
}

export interface Highlight {
  id: string;
  clientId: string;
  title: string;
  coverUrl: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  clientId: string;
  type: PostType;
  caption: string;
  location: string | null;
  altText: string | null;
  hashtags: string[];
  status: PostStatus;
  approvalStatus: ApprovalStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  isPinned: boolean;
  gridPosition: number;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostMedia {
  id: string;
  postId: string;
  mediaType: MediaType;
  /** `data:`/`blob:`/`https:` URL, `local:<id>` demo reference, or `gradient:` placeholder. */
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  position: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorName: string;
  authorEmail: string | null;
  body: string;
  commentType: CommentType;
  resolved: boolean;
  createdAt: string;
}

export interface Approval {
  id: string;
  clientId: string;
  postId: string;
  reviewerName: string;
  reviewerEmail: string | null;
  status: Extract<ApprovalStatus, "approved" | "changes_requested">;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLink {
  id: string;
  clientId: string;
  token: string;
  isActive: boolean;
  expiresAt: string | null;
  allowComments: boolean;
  allowApproval: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  clientId: string;
  type: ActivityType;
  description: string;
  createdAt: string;
}

/** Full client payload used by the workspace and share pages. */
export interface ClientBundle {
  client: Client;
  highlights: Highlight[];
  posts: Post[];
  media: PostMedia[];
  comments: Comment[];
  approvals: Approval[];
  shareLinks: ShareLink[];
}

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  not_sent: "Not sent",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};

export const POST_TYPE_LABELS: Record<PostType, string> = {
  image: "Post",
  carousel: "Carousel",
  reel: "Reel",
};

export const MAX_PINNED_POSTS = 3;
