import type {
  Activity,
  AppNotification,
  Approval,
  Client,
  ClientBundle,
  Comment,
  Highlight,
  Post,
  PostMedia,
  ShareLink,
  TeamMember,
  User,
} from "@/types/domain";

/**
 * Snapshot of everything the signed-in user can see: the shared team
 * workspace for approved accounts, only the user record for pending ones.
 */
export interface WorkspaceSnapshot {
  user: User;
  clients: Client[];
  highlights: Highlight[];
  posts: Post[];
  media: PostMedia[];
  comments: Comment[];
  approvals: Approval[];
  shareLinks: ShareLink[];
  activity: Activity[];
  /** Newest first; `isRead` is the signed-in user's own read state. */
  notifications: AppNotification[];
}

export interface UploadResult {
  /** Persistent URL/reference to store on the entity (`local:` in demo mode). */
  url: string;
  width: number | null;
  height: number | null;
}

export interface ShareResolution {
  shareLink: ShareLink;
  bundle: ClientBundle;
}

/**
 * Why a public share request was refused. "inactive" also covers a link
 * whose comments/approvals are switched off for the attempted action.
 */
export type ShareError = "not_found" | "inactive" | "expired" | "rate_limited";

/** Per-link reviewer submission limits (mirrored in migration 0006). */
export const SHARE_RATE_LIMITS = [
  { windowMs: 10 * 60 * 1000, max: 60 },
  { windowMs: 24 * 60 * 60 * 1000, max: 300 },
] as const;

/**
 * Persistence contract implemented by the demo (IndexedDB) and Supabase
 * backends. UI code only ever talks to this interface.
 */
export interface Repository {
  readonly mode: "demo" | "supabase";

  loadSnapshot(): Promise<WorkspaceSnapshot>;

  updateUser(patch: Partial<Pick<User, "displayName" | "avatarUrl">>): Promise<User>;

  createClient(
    input: Omit<Client, "id" | "ownerId" | "slug" | "createdAt" | "updatedAt">,
  ): Promise<Client>;
  updateClient(id: string, patch: Partial<Client>): Promise<Client>;
  duplicateClient(id: string): Promise<Client>;
  /** Owner only — members get an error ("Only the workspace owner …"). */
  deleteClient(id: string): Promise<void>;

  createHighlight(input: Omit<Highlight, "id" | "createdAt" | "updatedAt">): Promise<Highlight>;
  updateHighlight(id: string, patch: Partial<Highlight>): Promise<Highlight>;
  reorderHighlights(clientId: string, orderedIds: string[]): Promise<void>;
  deleteHighlight(id: string): Promise<void>;

  createPost(
    input: Omit<Post, "id" | "createdAt" | "updatedAt">,
    media: Array<Omit<PostMedia, "id" | "postId" | "createdAt">>,
  ): Promise<Post>;
  updatePost(id: string, patch: Partial<Post>): Promise<Post>;
  setPostMedia(
    postId: string,
    media: Array<Omit<PostMedia, "id" | "postId" | "createdAt"> & { id?: string }>,
  ): Promise<PostMedia[]>;
  reorderPosts(clientId: string, orderedIds: string[]): Promise<void>;
  deletePost(id: string): Promise<void>;

  createComment(input: Omit<Comment, "id" | "createdAt">): Promise<Comment>;
  setCommentResolved(id: string, resolved: boolean): Promise<Comment>;

  recordApproval(input: Omit<Approval, "id" | "createdAt" | "updatedAt">): Promise<Approval>;

  createShareLink(input: Omit<ShareLink, "id" | "token" | "createdAt">): Promise<ShareLink>;
  updateShareLink(id: string, patch: Partial<ShareLink>): Promise<ShareLink>;
  regenerateShareToken(id: string): Promise<ShareLink>;

  recordActivity(input: Omit<Activity, "id" | "createdAt">): Promise<Activity>;

  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  /** Owner only: every account, pending ones first. */
  listTeam(): Promise<TeamMember[]>;
  /** Owner only: let a pending account into the workspace. */
  approveMember(userId: string): Promise<void>;
  /** Owner only: delete a pending account completely (they can sign up again). */
  rejectMember(userId: string): Promise<void>;

  /** Store a file, returning a persistent reference. Reports progress 0..1. */
  uploadFile(
    file: File,
    bucket: "avatars" | "highlights" | "post-media",
    onProgress?: (fraction: number) => void,
  ): Promise<UploadResult>;

  /** Resolve a stored `local:` reference to a displayable URL (demo mode). */
  resolveMediaUrl(url: string): Promise<string>;

  /**
   * Public share access — no auth required. The bundle is the reviewer view:
   * completed posts only (no designer content packages), no reviewer emails,
   * no share links. `shareLink` carries the link's real permission flags.
   */
  resolveShareToken(token: string): Promise<ShareResolution | ShareError>;
  /** Standalone reviewer feedback — always a "general" comment. */
  submitPublicComment(
    token: string,
    input: Omit<Comment, "id" | "createdAt" | "resolved" | "commentType">,
  ): Promise<Comment | ShareError>;
  /**
   * Reviewer decision. A non-empty message is also posted as a companion
   * comment (change_request / general) when the link allows comments; both
   * count as ONE submission for rate limiting.
   */
  submitPublicApproval(
    token: string,
    input: Omit<Approval, "id" | "createdAt" | "updatedAt" | "clientId">,
  ): Promise<Approval | ShareError>;

  /** Demo only: wipe all data and restore the seed. */
  resetDemoData?(seed: boolean): Promise<void>;
}

export function isShareError(value: unknown): value is ShareError {
  return (
    value === "not_found" || value === "inactive" || value === "expired" || value === "rate_limited"
  );
}

/** Error messages for team rules, shared by both repositories and the UI. */
export const TEAM_ERRORS = {
  notOwner: "Only the workspace owner can do this.",
  deleteClient: "Only the workspace owner can delete clients.",
  notPending: "That account is no longer waiting for approval.",
} as const;
