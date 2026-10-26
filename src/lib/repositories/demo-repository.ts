import { createId, createToken, slugify } from "@/lib/id";
import {
  idbClearAll,
  idbGetMedia,
  idbGetState,
  idbPutMedia,
  idbPutState,
} from "@/lib/idb";
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
import { createEmptySnapshot, createSeedSnapshot } from "./seed";
import type {
  Repository,
  ShareError,
  ShareResolution,
  UploadResult,
  WorkspaceSnapshot,
} from "./types";
import { SHARE_RATE_LIMITS } from "./types";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function now(): string {
  return new Date().toISOString();
}

function readFileAsDataUrl(file: File, onProgress?: (f: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function readImageSize(dataUrl: string): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: null, height: null });
    img.src = dataUrl;
  });
}

/**
 * IndexedDB-backed repository powering demo mode. The whole workspace is held
 * in memory and persisted after every mutation; uploaded files are stored as
 * data URLs in a separate media store and referenced as `local:<id>`.
 */
export class DemoRepository implements Repository {
  readonly mode = "demo" as const;

  private state: WorkspaceSnapshot | null = null;
  private mediaUrlCache = new Map<string, string>();
  private channel: BroadcastChannel | null = null;
  /** Share link id → timestamps (ms) of recent reviewer submissions. */
  private shareSubmissions = new Map<string, number[]>();

  constructor() {
    // Cross-tab "realtime": other tabs announce persisted changes; drop the
    // in-memory cache so the next loadSnapshot re-reads IndexedDB.
    try {
      this.channel = new BroadcastChannel("gridline-workspace");
      this.channel.onmessage = () => {
        this.state = null;
      };
    } catch {
      this.channel = null;
    }
  }

  private broadcast(): void {
    try {
      this.channel?.postMessage("changed");
    } catch {
      // channel closed or unsupported — refresh-on-focus still covers it
    }
  }

  private async ensureState(): Promise<WorkspaceSnapshot> {
    if (this.state) return this.state;
    const stored = await idbGetState<WorkspaceSnapshot>();
    if (stored && !Array.isArray(stored.notifications)) stored.notifications = [];
    this.state = stored ?? createSeedSnapshot();
    if (!stored) await idbPutState(this.state);
    return this.state;
  }

  private async persist(): Promise<void> {
    if (this.state) await idbPutState(this.state);
  }

  private touchClient(clientId: string): void {
    const client = this.state?.clients.find((c) => c.id === clientId);
    if (client) client.updatedAt = now();
  }

  async loadSnapshot(): Promise<WorkspaceSnapshot> {
    const state = await this.ensureState();
    return structuredClone(state);
  }

  async updateUser(patch: Partial<Pick<User, "displayName" | "avatarUrl">>): Promise<User> {
    const state = await this.ensureState();
    state.user = { ...state.user, ...patch, updatedAt: now() };
    await this.persist();
    return structuredClone(state.user);
  }

  async createClient(
    input: Omit<Client, "id" | "ownerId" | "slug" | "createdAt" | "updatedAt">,
  ): Promise<Client> {
    const state = await this.ensureState();
    const timestamp = now();
    const client: Client = {
      ...input,
      id: createId(),
      ownerId: state.user.id,
      slug: slugify(input.name),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.clients.push(client);
    await this.persist();
    return structuredClone(client);
  }

  async updateClient(id: string, patch: Partial<Client>): Promise<Client> {
    const state = await this.ensureState();
    const client = state.clients.find((c) => c.id === id);
    if (!client) throw new Error("Client not found");
    Object.assign(client, patch, { id: client.id, updatedAt: now() });
    await this.persist();
    return structuredClone(client);
  }

  async duplicateClient(id: string): Promise<Client> {
    const state = await this.ensureState();
    const source = state.clients.find((c) => c.id === id);
    if (!source) throw new Error("Client not found");
    const timestamp = now();
    const copy: Client = {
      ...source,
      id: createId(),
      name: `${source.name} copy`,
      slug: slugify(`${source.name}-copy`),
      instagramUsername: `${source.instagramUsername}.copy`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.clients.push(copy);

    const idMap = new Map<string, string>();
    for (const highlight of state.highlights.filter((h) => h.clientId === id)) {
      state.highlights.push({ ...highlight, id: createId(), clientId: copy.id });
    }
    for (const post of state.posts.filter((p) => p.clientId === id)) {
      const newPostId = createId();
      idMap.set(post.id, newPostId);
      state.posts.push({ ...post, id: newPostId, clientId: copy.id });
    }
    for (const media of state.media) {
      const newPostId = idMap.get(media.postId);
      if (newPostId) state.media.push({ ...media, id: createId(), postId: newPostId });
    }
    await this.persist();
    return structuredClone(copy);
  }

  async deleteClient(id: string): Promise<void> {
    const state = await this.ensureState();
    const postIds = new Set(state.posts.filter((p) => p.clientId === id).map((p) => p.id));
    state.clients = state.clients.filter((c) => c.id !== id);
    state.highlights = state.highlights.filter((h) => h.clientId !== id);
    state.posts = state.posts.filter((p) => p.clientId !== id);
    state.media = state.media.filter((m) => !postIds.has(m.postId));
    state.comments = state.comments.filter((c) => !postIds.has(c.postId));
    state.approvals = state.approvals.filter((a) => a.clientId !== id);
    state.shareLinks = state.shareLinks.filter((s) => s.clientId !== id);
    state.activity = state.activity.filter((a) => a.clientId !== id);
    state.notifications = state.notifications.filter((n) => n.clientId !== id);
    await this.persist();
  }

  async createHighlight(
    input: Omit<Highlight, "id" | "createdAt" | "updatedAt">,
  ): Promise<Highlight> {
    const state = await this.ensureState();
    const timestamp = now();
    const highlight: Highlight = { ...input, id: createId(), createdAt: timestamp, updatedAt: timestamp };
    state.highlights.push(highlight);
    this.touchClient(input.clientId);
    await this.persist();
    return structuredClone(highlight);
  }

  async updateHighlight(id: string, patch: Partial<Highlight>): Promise<Highlight> {
    const state = await this.ensureState();
    const highlight = state.highlights.find((h) => h.id === id);
    if (!highlight) throw new Error("Highlight not found");
    Object.assign(highlight, patch, { id: highlight.id, updatedAt: now() });
    this.touchClient(highlight.clientId);
    await this.persist();
    return structuredClone(highlight);
  }

  async reorderHighlights(clientId: string, orderedIds: string[]): Promise<void> {
    const state = await this.ensureState();
    orderedIds.forEach((highlightId, index) => {
      const highlight = state.highlights.find((h) => h.id === highlightId && h.clientId === clientId);
      if (highlight) highlight.position = index;
    });
    this.touchClient(clientId);
    await this.persist();
  }

  async deleteHighlight(id: string): Promise<void> {
    const state = await this.ensureState();
    const highlight = state.highlights.find((h) => h.id === id);
    state.highlights = state.highlights.filter((h) => h.id !== id);
    if (highlight) this.touchClient(highlight.clientId);
    await this.persist();
  }

  async createPost(
    input: Omit<Post, "id" | "createdAt" | "updatedAt">,
    media: Array<Omit<PostMedia, "id" | "postId" | "createdAt">>,
  ): Promise<Post> {
    const state = await this.ensureState();
    const timestamp = now();
    const post: Post = { ...input, id: createId(), createdAt: timestamp, updatedAt: timestamp };
    state.posts.push(post);
    for (const item of media) {
      state.media.push({ ...item, id: createId(), postId: post.id, createdAt: timestamp });
    }
    this.touchClient(input.clientId);
    await this.persist();
    return structuredClone(post);
  }

  async updatePost(id: string, patch: Partial<Post>): Promise<Post> {
    const state = await this.ensureState();
    const post = state.posts.find((p) => p.id === id);
    if (!post) throw new Error("Post not found");
    Object.assign(post, patch, { id: post.id, updatedAt: now() });
    this.touchClient(post.clientId);
    await this.persist();
    return structuredClone(post);
  }

  async setPostMedia(
    postId: string,
    media: Array<Omit<PostMedia, "id" | "postId" | "createdAt"> & { id?: string }>,
  ): Promise<PostMedia[]> {
    const state = await this.ensureState();
    const timestamp = now();
    state.media = state.media.filter((m) => m.postId !== postId);
    const records: PostMedia[] = media.map((item, index) => ({
      ...item,
      id: item.id ?? createId(),
      postId,
      position: index,
      createdAt: timestamp,
    }));
    state.media.push(...records);
    const post = state.posts.find((p) => p.id === postId);
    if (post) {
      post.updatedAt = timestamp;
      this.touchClient(post.clientId);
    }
    await this.persist();
    return structuredClone(records);
  }

  async reorderPosts(clientId: string, orderedIds: string[]): Promise<void> {
    const state = await this.ensureState();
    orderedIds.forEach((postId, index) => {
      const post = state.posts.find((p) => p.id === postId && p.clientId === clientId);
      if (post) post.gridPosition = index;
    });
    this.touchClient(clientId);
    await this.persist();
  }

  async deletePost(id: string): Promise<void> {
    const state = await this.ensureState();
    const post = state.posts.find((p) => p.id === id);
    state.posts = state.posts.filter((p) => p.id !== id);
    state.media = state.media.filter((m) => m.postId !== id);
    state.comments = state.comments.filter((c) => c.postId !== id);
    state.approvals = state.approvals.filter((a) => a.postId !== id);
    state.notifications = state.notifications.filter((n) => n.postId !== id);
    if (post) this.touchClient(post.clientId);
    await this.persist();
  }

  async createComment(input: Omit<Comment, "id" | "createdAt">): Promise<Comment> {
    const state = await this.ensureState();
    const comment: Comment = { ...input, id: createId(), createdAt: now() };
    state.comments.push(comment);
    const post = state.posts.find((p) => p.id === input.postId);
    if (post) post.commentsCount = state.comments.filter((c) => c.postId === post.id).length;
    await this.persist();
    return structuredClone(comment);
  }

  async setCommentResolved(id: string, resolved: boolean): Promise<Comment> {
    const state = await this.ensureState();
    const comment = state.comments.find((c) => c.id === id);
    if (!comment) throw new Error("Comment not found");
    comment.resolved = resolved;
    await this.persist();
    return structuredClone(comment);
  }

  async recordApproval(
    input: Omit<Approval, "id" | "createdAt" | "updatedAt">,
  ): Promise<Approval> {
    const state = await this.ensureState();
    const timestamp = now();
    // Review events are immutable history — always append, never rewrite.
    const approval: Approval = { ...input, id: createId(), createdAt: timestamp, updatedAt: timestamp };
    state.approvals.push(approval);
    const post = state.posts.find((p) => p.id === input.postId);
    if (post) {
      post.approvalStatus = input.status;
      post.updatedAt = timestamp;
      this.touchClient(post.clientId);
    }
    await this.persist();
    return structuredClone(approval);
  }

  async createShareLink(input: Omit<ShareLink, "id" | "token" | "createdAt">): Promise<ShareLink> {
    const state = await this.ensureState();
    const link: ShareLink = { ...input, id: createId(), token: createToken(), createdAt: now() };
    state.shareLinks.push(link);
    await this.persist();
    return structuredClone(link);
  }

  async updateShareLink(id: string, patch: Partial<ShareLink>): Promise<ShareLink> {
    const state = await this.ensureState();
    const link = state.shareLinks.find((s) => s.id === id);
    if (!link) throw new Error("Share link not found");
    Object.assign(link, patch, { id: link.id });
    await this.persist();
    return structuredClone(link);
  }

  async regenerateShareToken(id: string): Promise<ShareLink> {
    return this.updateShareLink(id, { token: createToken() });
  }

  async recordActivity(input: Omit<Activity, "id" | "createdAt">): Promise<Activity> {
    const state = await this.ensureState();
    const record: Activity = { ...input, id: createId(), createdAt: now() };
    state.activity.unshift(record);
    state.activity = state.activity.slice(0, 200);
    await this.persist();
    return structuredClone(record);
  }

  /**
   * Owner notification for a client review response. The recipient is always
   * resolved from the client record — never supplied by the reviewer. Skips
   * identical events created moments ago so a retried request stays single.
   */
  private async createNotification(
    input: Omit<AppNotification, "id" | "recipientId" | "isRead" | "createdAt">,
  ): Promise<void> {
    const state = await this.ensureState();
    const client = state.clients.find((c) => c.id === input.clientId);
    if (!client) return;
    // Deliberately type-agnostic: an approval note is also stored as a
    // comment, and the mirrored message must not notify twice.
    const duplicate = state.notifications.find(
      (n) =>
        n.recipientId === client.ownerId &&
        n.postId === input.postId &&
        n.message === input.message &&
        Date.now() - new Date(n.createdAt).getTime() < 30_000,
    );
    if (duplicate) return;
    state.notifications.unshift({
      ...input,
      id: createId(),
      recipientId: client.ownerId,
      isRead: false,
      createdAt: now(),
    });
    state.notifications = state.notifications.slice(0, 200);
    await this.persist();
  }

  async markNotificationRead(id: string): Promise<void> {
    const state = await this.ensureState();
    const notification = state.notifications.find(
      (n) => n.id === id && n.recipientId === state.user.id,
    );
    if (!notification || notification.isRead) return;
    notification.isRead = true;
    await this.persist();
  }

  async markAllNotificationsRead(): Promise<void> {
    const state = await this.ensureState();
    let changed = false;
    for (const notification of state.notifications) {
      if (notification.recipientId === state.user.id && !notification.isRead) {
        notification.isRead = true;
        changed = true;
      }
    }
    if (changed) await this.persist();
  }

  async uploadFile(
    file: File,
    _bucket: "avatars" | "highlights" | "post-media",
    onProgress?: (fraction: number) => void,
  ): Promise<UploadResult> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`File is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`);
    }
    const dataUrl = await readFileAsDataUrl(file, onProgress);
    const mediaId = createId();
    await idbPutMedia(mediaId, dataUrl);
    this.mediaUrlCache.set(`local:${mediaId}`, dataUrl);
    const size = file.type.startsWith("image/")
      ? await readImageSize(dataUrl)
      : { width: null, height: null };
    onProgress?.(1);
    return { url: `local:${mediaId}`, ...size };
  }

  async resolveMediaUrl(url: string): Promise<string> {
    if (!url.startsWith("local:")) return url;
    const cached = this.mediaUrlCache.get(url);
    if (cached) return cached;
    const stored = await idbGetMedia(url.slice("local:".length));
    if (!stored) throw new Error("Stored media missing");
    this.mediaUrlCache.set(url, stored);
    return stored;
  }

  /**
   * What a reviewer may see — mirrors the `resolve_share` RPC: completed posts
   * only (no designer content packages), no reviewer emails, no share links.
   */
  private reviewerBundle(state: WorkspaceSnapshot, clientId: string): ClientBundle | null {
    const client = state.clients.find((c) => c.id === clientId);
    if (!client) return null;
    const posts = state.posts.filter((p) => p.clientId === clientId && p.stage === "post");
    const postIds = new Set(posts.map((p) => p.id));
    return structuredClone({
      client,
      highlights: state.highlights.filter((h) => h.clientId === clientId),
      posts,
      media: state.media.filter((m) => postIds.has(m.postId)),
      comments: state.comments
        .filter((c) => postIds.has(c.postId))
        .map((c) => ({ ...c, authorEmail: null })),
      approvals: state.approvals
        .filter((a) => a.clientId === clientId && postIds.has(a.postId))
        .map((a) => ({ ...a, reviewerEmail: null })),
      shareLinks: [],
    });
  }

  /**
   * Per-link reviewer rate limit (same limits as the `share_rate_limit` SQL
   * helper). Kept in memory — demo reviewers share the owner's browser anyway.
   * Returns false, without recording, when the link is over a limit.
   */
  private takeShareSubmission(linkId: string): boolean {
    const nowMs = Date.now();
    const longestWindow = Math.max(...SHARE_RATE_LIMITS.map((l) => l.windowMs));
    const recent = (this.shareSubmissions.get(linkId) ?? []).filter(
      (t) => nowMs - t < longestWindow,
    );
    const limited = SHARE_RATE_LIMITS.some(
      (limit) => recent.filter((t) => nowMs - t < limit.windowMs).length >= limit.max,
    );
    if (!limited) recent.push(nowMs);
    this.shareSubmissions.set(linkId, recent);
    return !limited;
  }

  /** A share token only grants access to its own client's completed posts. */
  private reviewablePost(state: WorkspaceSnapshot, link: ShareLink, postId: string): Post | null {
    const post = state.posts.find((p) => p.id === postId);
    return post && post.clientId === link.clientId && post.stage === "post" ? post : null;
  }

  private async findValidShare(token: string): Promise<ShareLink | ShareError> {
    const state = await this.ensureState();
    const link = state.shareLinks.find((s) => s.token === token);
    if (!link) return "not_found";
    if (!link.isActive) return "inactive";
    if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return "expired";
    return link;
  }

  async resolveShareToken(token: string): Promise<ShareResolution | ShareError> {
    const link = await this.findValidShare(token);
    if (typeof link === "string") return link;
    const state = await this.ensureState();
    const bundle = this.reviewerBundle(state, link.clientId);
    if (!bundle) return "not_found";
    return { shareLink: structuredClone(link), bundle };
  }

  async submitPublicComment(
    token: string,
    input: Omit<Comment, "id" | "createdAt" | "resolved" | "commentType">,
  ): Promise<Comment | ShareError> {
    const link = await this.findValidShare(token);
    if (typeof link === "string") return link;
    if (!link.allowComments) return "inactive";
    const state = await this.ensureState();
    const post = this.reviewablePost(state, link, input.postId);
    if (!post) return "not_found";
    if (!this.takeShareSubmission(link.id)) return "rate_limited";
    const comment = await this.createComment({
      ...input,
      commentType: "general",
      resolved: false,
    });
    await this.createNotification({
      clientId: link.clientId,
      postId: post.id,
      type: "review_feedback_received",
      title: `${input.authorName} left feedback`,
      message: input.body,
    });
    await this.recordActivity({
      clientId: link.clientId,
      type: "comment_received",
      description: `${input.authorName} left a comment`,
    });
    this.broadcast();
    return { ...comment, authorEmail: null };
  }

  async submitPublicApproval(
    token: string,
    input: Omit<Approval, "id" | "createdAt" | "updatedAt" | "clientId">,
  ): Promise<Approval | ShareError> {
    const link = await this.findValidShare(token);
    if (typeof link === "string") return link;
    if (!link.allowApproval) return "inactive";
    const state = await this.ensureState();
    const post = this.reviewablePost(state, link, input.postId);
    if (!post) return "not_found";
    // One submission covers the approval and its companion comment.
    if (!this.takeShareSubmission(link.id)) return "rate_limited";
    const message = input.message?.trim() || null;
    const approval = await this.recordApproval({ ...input, message, clientId: link.clientId });
    // The message also joins the post's comment thread unless comments are off
    // (it is kept on the approval either way). Its owner notification is the
    // approval's own, below.
    if (message && link.allowComments) {
      await this.createComment({
        postId: post.id,
        authorName: input.reviewerName,
        authorEmail: input.reviewerEmail,
        body: message,
        commentType: input.status === "changes_requested" ? "change_request" : "general",
        resolved: false,
      });
    }
    await this.createNotification({
      clientId: link.clientId,
      postId: post.id,
      type: input.status === "approved" ? "review_approved" : "review_changes_requested",
      title: `${input.reviewerName} ${
        input.status === "approved" ? "approved the post" : "requested changes"
      }`,
      message:
        message ??
        (input.status === "approved" ? "The post is ready." : "Open the post to see the request."),
    });
    await this.recordActivity({
      clientId: link.clientId,
      type: input.status === "approved" ? "approval_received" : "changes_requested",
      description: `${input.reviewerName} ${
        input.status === "approved" ? "approved a post" : "requested changes on a post"
      }`,
    });
    this.broadcast();
    return { ...approval, reviewerEmail: null };
  }

  async resetDemoData(seed: boolean): Promise<void> {
    await idbClearAll();
    this.mediaUrlCache.clear();
    this.state = seed ? createSeedSnapshot() : createEmptySnapshot();
    await this.persist();
  }
}
