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
  User,
} from "@/types/domain";

/** Snapshot of everything the signed-in user can see. */
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
  /** Newest first, scoped to the signed-in user. */
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

export type ShareError = "not_found" | "inactive" | "expired";

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

  /** Store a file, returning a persistent reference. Reports progress 0..1. */
  uploadFile(
    file: File,
    bucket: "avatars" | "highlights" | "post-media",
    onProgress?: (fraction: number) => void,
  ): Promise<UploadResult>;

  /** Resolve a stored `local:` reference to a displayable URL (demo mode). */
  resolveMediaUrl(url: string): Promise<string>;

  /** Public share access — no auth required. */
  resolveShareToken(token: string): Promise<ShareResolution | ShareError>;
  submitPublicComment(
    token: string,
    input: Omit<Comment, "id" | "createdAt" | "resolved">,
  ): Promise<Comment | ShareError>;
  submitPublicApproval(
    token: string,
    input: Omit<Approval, "id" | "createdAt" | "updatedAt" | "clientId">,
  ): Promise<Approval | ShareError>;

  /** Demo only: wipe all data and restore the seed. */
  resetDemoData?(seed: boolean): Promise<void>;
}

export function isShareError(value: unknown): value is ShareError {
  return value === "not_found" || value === "inactive" || value === "expired";
}
