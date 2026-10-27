/**
 * Domain model shared by every persistence backend (demo IndexedDB and
 * Supabase). All timestamps are ISO 8601 strings; `scheduledAt` is stored as
 * an ISO string produced from the user's local wall-clock time.
 */

export type PostType = "image" | "carousel" | "reel";
export type PostStatus = "draft" | "scheduled" | "published";
/**
 * Lifecycle stage. A designer creates a "content" package (name + original
 * media only). It becomes a real Instagram "post" only when the scheduler
 * completes the Create-post step after dropping it on a calendar day.
 */
export type ContentStage = "content" | "post";
export type ApprovalStatus =
  | "not_sent"
  | "awaiting_approval"
  | "approved"
  | "changes_requested";
export type Theme = "light" | "dark";
export type AccountType = "personal" | "creator" | "business";
export type MediaType = "image" | "video";
/**
 * How a video's cover image (stored in `thumbnailUrl`) was produced:
 * an auto-generated default frame, a frame the scheduler picked in the
 * player, or a custom uploaded image.
 */
export type CoverSource = "generated" | "frame" | "uploaded";
export type CommentType = "general" | "change_request";
/** In-app notification kinds: client review responses, and new sign-ups. */
export type NotificationType =
  | "review_changes_requested"
  | "review_approved"
  | "review_feedback_received"
  | "member_signup";
/** Who sees a notification: the whole team, or only the owner (sign-ups). */
export type NotificationAudience = "team" | "owner";
/** One owner for the whole platform; everyone else approved is a member. */
export type UserRole = "owner" | "member";
/** New accounts wait for the owner's approval before they see any data. */
export type AccountStatus = "pending" | "approved";
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
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

/** An account as listed on the owner's Team page. */
export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  /** Pending accounts may not have confirmed their email yet. */
  emailConfirmed: boolean;
  createdAt: string;
  approvedAt: string | null;
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
  /** Working title of the package, e.g. "Post 1", "Summer campaign 01". */
  name: string;
  /** "content" until the scheduler completes Create post. */
  stage: ContentStage;
  type: PostType;
  caption: string;
  location: string | null;
  altText: string | null;
  hashtags: string[];
  status: PostStatus;
  approvalStatus: ApprovalStatus;
  /** Publishing moment of a completed post (stage "post"): a real instant. */
  scheduledAt: string | null;
  /**
   * Calendar day a content package (stage "content") is placed on, as a
   * timezone-free "YYYY-MM-DD" — it shows on the same day for everyone.
   * Always null for completed posts.
   */
  scheduledDay: string | null;
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
  /** Set on video media whose thumbnailUrl is a chosen cover; null/absent otherwise. */
  coverSource?: CoverSource | null;
  /** Source-video timestamp in seconds for generated/frame covers. */
  coverTimestamp?: number | null;
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

/**
 * In-app notification for the team. Created server-side (Supabase triggers)
 * or by the demo repository: client responses through share links (whole
 * team) and new sign-ups waiting for approval (owner only). Nobody chooses
 * the audience from the client side.
 */
export interface AppNotification {
  id: string;
  audience: NotificationAudience;
  /** The client a review event belongs to; null for sign-ups. */
  clientId: string | null;
  postId: string | null;
  /** The account a sign-up notification is about. */
  subjectUserId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  /** Read by the signed-in user (read state is per person). */
  isRead: boolean;
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
