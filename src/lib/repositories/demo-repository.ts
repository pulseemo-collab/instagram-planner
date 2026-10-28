import { demoSessionVariant } from "@/lib/auth/session";
import { localDayKey } from "@/lib/dates";
import { createId, createToken, slugify } from "@/lib/id";
import { READ_NOTIFICATION_TTL_MS } from "@/lib/notifications";
import {
  idbClearAll,
  idbDeleteMedia,
  idbGetMedia,
  idbGetState,
  idbHasMedia,
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
  TeamMember,
  User,
} from "@/types/domain";
import { announceWorkspaceChange, onWorkspaceChange } from "./demo-channel";
import { createEmptySnapshot, createEmptyTeam, createSeedSnapshot, createSeedTeam } from "./seed";
import type {
  Repository,
  ShareError,
  ShareResolution,
  UploadResult,
  WorkspaceSnapshot,
} from "./types";
import { SHARE_RATE_LIMITS, TEAM_ERRORS, teamOrder } from "./types";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const LOCAL_PREFIX = "local:";
/** Web Lock serializing read-modify-write cycles across tabs (and within one). */
const WRITE_LOCK = "gridline-workspace-write";

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

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  // request() resolves with the callback's awaited result; the DOM typings
  // don't unwrap the callback's promise, hence the cast.
  return locks ? (locks.request(WRITE_LOCK, fn) as unknown as Promise<T>) : fn();
}

/** Rewrite every media URL field of a snapshot through `visit`. */
function mapMediaUrls(state: WorkspaceSnapshot, visit: (url: string | null) => string | null): void {
  state.user.avatarUrl = visit(state.user.avatarUrl);
  for (const client of state.clients) client.avatarUrl = visit(client.avatarUrl);
  for (const highlight of state.highlights) highlight.coverUrl = visit(highlight.coverUrl);
  for (const media of state.media) {
    media.url = visit(media.url) ?? media.url;
    media.thumbnailUrl = visit(media.thumbnailUrl);
  }
}

function localRefs(state: WorkspaceSnapshot): Set<string> {
  const refs = new Set<string>();
  mapMediaUrls(state, (url) => {
    if (url?.startsWith(LOCAL_PREFIX)) refs.add(url);
    return url;
  });
  return refs;
}

/**
 * Bring a stored state up to the current shape. Content packages saved
 * before timezone-free days existed kept their day as local midnight in
 * `scheduledAt`; demo data never leaves this browser, so its local day is
 * exactly the day it was dropped on.
 */
/**
 * "Preview what a new account sees": a just-signed-up account waiting for
 * approval sees nothing of the workspace (like RLS in Supabase mode).
 * Nothing is stored; the real demo workspace stays untouched.
 */
function pendingPreviewSnapshot(): WorkspaceSnapshot {
  const now = new Date().toISOString();
  return {
    ...createEmptySnapshot(),
    user: {
      id: "user-preview-pending",
      email: "new.teammate@example.com",
      displayName: "New teammate",
      avatarUrl: null,
      role: "member",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    },
  };
}

/**
 * The stored demo workspace: the snapshot plus the demo team (Team page).
 * The demo user is always the team's owner; pending accounts are simulated.
 */
type DemoState = WorkspaceSnapshot & { team: TeamMember[] };

function normalizeStored(state: DemoState): DemoState {
  if (!Array.isArray(state.notifications)) state.notifications = [];
  // Before the team workspace: the demo user was the only account.
  state.user.role ??= "owner";
  state.user.status ??= "approved";
  if (!Array.isArray(state.team)) state.team = createSeedTeam();
  for (const notification of state.notifications) {
    const legacy = notification as AppNotification & { recipientId?: string };
    if (legacy.audience === undefined) {
      legacy.audience = "team";
      legacy.subjectUserId = null;
      delete legacy.recipientId;
    }
  }
  for (const post of state.posts) {
    if (post.scheduledDay !== undefined) continue;
    if (post.stage === "content" && post.scheduledAt) {
      post.scheduledDay = localDayKey(post.scheduledAt);
      post.scheduledAt = null;
    } else {
      post.scheduledDay = null;
    }
  }
  return state;
}

/** True when a stored state predates the current shape and must be repaired. */
function needsRepair(state: DemoState): boolean {
  return (
    !Array.isArray(state.notifications) ||
    !Array.isArray(state.team) ||
    state.user.role === undefined ||
    state.notifications.some((n) => n.audience === undefined) ||
    state.posts.some((post) => post.scheduledDay === undefined) ||
    hasInlineMedia(state)
  );
}

function hasInlineMedia(state: WorkspaceSnapshot): boolean {
  let found = false;
  mapMediaUrls(state, (url) => {
    if (url?.startsWith("data:")) found = true;
    return url;
  });
  return found;
}

function touchClient(state: WorkspaceSnapshot, clientId: string): void {
  const client = state.clients.find((c) => c.id === clientId);
  if (client) client.updatedAt = now();
}

function addComment(state: WorkspaceSnapshot, input: Omit<Comment, "id" | "createdAt">): Comment {
  const comment: Comment = { ...input, id: createId(), createdAt: now() };
  state.comments.push(comment);
  const post = state.posts.find((p) => p.id === input.postId);
  if (post) post.commentsCount = state.comments.filter((c) => c.postId === post.id).length;
  return comment;
}

function addApproval(
  state: WorkspaceSnapshot,
  input: Omit<Approval, "id" | "createdAt" | "updatedAt">,
): Approval {
  const timestamp = now();
  // Review events are immutable history — always append, never rewrite.
  const approval: Approval = { ...input, id: createId(), createdAt: timestamp, updatedAt: timestamp };
  state.approvals.push(approval);
  const post = state.posts.find((p) => p.id === input.postId);
  if (post) {
    post.approvalStatus = input.status;
    post.updatedAt = timestamp;
    touchClient(state, post.clientId);
  }
  return approval;
}

function addActivity(state: WorkspaceSnapshot, input: Omit<Activity, "id" | "createdAt">): Activity {
  const record: Activity = { ...input, id: createId(), createdAt: now() };
  state.activity.unshift(record);
  state.activity = state.activity.slice(0, 200);
  return record;
}

/**
 * Team notification for a client review response (the reviewer never picks
 * who is notified). Skips identical events created moments ago so a retried
 * request stays single.
 */
function addNotification(
  state: WorkspaceSnapshot,
  input: Omit<AppNotification, "id" | "audience" | "subjectUserId" | "isRead" | "createdAt">,
): void {
  if (!state.clients.some((c) => c.id === input.clientId)) return;
  // Deliberately type-agnostic: an approval note is also stored as a
  // comment, and the mirrored message must not notify twice.
  const duplicate = state.notifications.find(
    (n) =>
      n.audience === "team" &&
      n.clientId === input.clientId &&
      n.postId === input.postId &&
      n.message === input.message &&
      Date.now() - new Date(n.createdAt).getTime() < 30_000,
  );
  if (duplicate) return;
  state.notifications.unshift({
    ...input,
    id: createId(),
    audience: "team",
    subjectUserId: null,
    isRead: false,
    createdAt: now(),
  });
  state.notifications = state.notifications.slice(0, 200);
}

/** Read notifications older than 30 days are deleted (like migration 0011). */
function purgeReadNotifications(state: WorkspaceSnapshot): void {
  const cutoff = Date.now() - READ_NOTIFICATION_TTL_MS;
  state.notifications = state.notifications.filter(
    (n) => !n.isRead || new Date(n.createdAt).getTime() >= cutoff,
  );
}

/** An account that stopped being pending resolves its "waiting for approval" notice. */
function resolveSignup(state: WorkspaceSnapshot, userId: string): void {
  state.notifications = state.notifications.filter(
    (n) => !(n.type === "member_signup" && n.subjectUserId === userId),
  );
}

function requireOwner(state: DemoState): void {
  if (state.user.role !== "owner") throw new Error(TEAM_ERRORS.notOwner);
}

/** A member (never the owner or the caller) in one of the given states. */
function findMember(
  state: DemoState,
  userId: string,
  statuses: TeamMember["status"][],
  notFound: string,
): TeamMember {
  requireOwner(state);
  if (userId === state.user.id) throw new Error(TEAM_ERRORS.notSelf);
  const member = state.team.find(
    (m) => m.id === userId && m.role === "member" && statuses.includes(m.status),
  );
  if (!member) throw new Error(notFound);
  return member;
}

function findValidShare(state: WorkspaceSnapshot, token: string): ShareLink | ShareError {
  const link = state.shareLinks.find((s) => s.token === token);
  if (!link) return "not_found";
  if (!link.isActive) return "inactive";
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return "expired";
  return link;
}

/**
 * A reviewer submission is allowed when the link is valid, permits the
 * action, and the post is one of its client's completed posts.
 */
function checkSubmission(
  state: WorkspaceSnapshot,
  token: string,
  postId: string,
  permission: "allowComments" | "allowApproval",
): { link: ShareLink; post: Post } | ShareError {
  const link = findValidShare(state, token);
  if (typeof link === "string") return link;
  if (!link[permission]) return "inactive";
  const post = state.posts.find((p) => p.id === postId);
  if (!post || post.clientId !== link.clientId || post.stage !== "post") return "not_found";
  return { link, post };
}

/**
 * What a reviewer may see — mirrors the `resolve_share` RPC: completed posts
 * only (no designer content packages), no reviewer emails, no share links.
 */
function reviewerBundle(state: WorkspaceSnapshot, clientId: string): ClientBundle | null {
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
 * IndexedDB-backed repository powering demo mode. The workspace snapshot
 * lives in the "state" store and uploaded files as data URLs in the "media"
 * store, referenced from the snapshot as `local:<id>`.
 *
 * Integrity rules:
 * - Every mutation runs through `write()`: under a cross-tab Web Lock it
 *   re-reads the latest stored state, applies the change, saves, and
 *   announces it to other tabs — so a stale tab can never overwrite newer
 *   data (audit #14).
 * - The stored state never contains inline `data:` media. The UI works with
 *   resolved data URLs; `write()` maps them back to their `local:` refs and
 *   repairs states saved before this rule existed (audit #4).
 * - Media that a write stops referencing is deleted from the media store
 *   (audit #19). Uploads not yet saved into the state are never touched.
 */
export class DemoRepository implements Repository {
  readonly mode = "demo" as const;

  /** Read cache of the stored state; dropped whenever another tab writes. */
  private cache: DemoState | null = null;
  /** `local:` ref ↔ data URL, both directions (display resolution and undo). */
  private dataUrlByRef = new Map<string, string>();
  private refByDataUrl = new Map<string, string>();
  /** Share link id → timestamps (ms) of recent reviewer submissions. */
  private shareSubmissions = new Map<string, number[]>();

  constructor() {
    onWorkspaceChange(() => {
      this.cache = null;
    });
  }

  /* ------------------------------ plumbing ------------------------------ */

  private remember(ref: string, dataUrl: string): void {
    this.dataUrlByRef.set(ref, dataUrl);
    this.refByDataUrl.set(dataUrl, ref);
  }

  private forget(ref: string): void {
    const dataUrl = this.dataUrlByRef.get(ref);
    this.dataUrlByRef.delete(ref);
    if (dataUrl !== undefined && this.refByDataUrl.get(dataUrl) === ref) {
      this.refByDataUrl.delete(dataUrl);
    }
  }

  private async loadStored(): Promise<DemoState> {
    const stored = await idbGetState<DemoState>();
    return stored ? normalizeStored(stored) : { ...createSeedSnapshot(), team: createSeedTeam() };
  }

  /** Latest stored workspace (cached until this or another tab writes). */
  private async read(): Promise<DemoState> {
    if (this.cache) return this.cache;
    const stored = await idbGetState<DemoState>();
    if (stored && !needsRepair(stored)) {
      this.cache = stored;
      return stored;
    }
    // First run (seed it) or a state saved by an older version (repair it).
    await this.write(() => undefined);
    return this.cache ?? this.loadStored();
  }

  /** Locked read-modify-write cycle — the only way the stored state changes. */
  private write<T>(fn: (state: DemoState) => T | Promise<T>): Promise<T> {
    return withWriteLock(async () => {
      const state = await this.loadStored();
      const before = localRefs(state);
      const result = await fn(state);
      await this.storeInlineMedia(state);
      await idbPutState(state);
      this.cache = state;
      await this.deleteUnreferencedMedia(before, localRefs(state));
      announceWorkspaceChange();
      return result;
    });
  }

  /**
   * Replace inline `data:` media with `local:` refs: the original ref when the
   * data URL came from resolving one (and that file still exists), otherwise
   * a new media-store entry.
   */
  private async storeInlineMedia(state: WorkspaceSnapshot): Promise<void> {
    const inline = new Set<string>();
    mapMediaUrls(state, (url) => {
      if (url?.startsWith("data:")) inline.add(url);
      return url;
    });
    for (const dataUrl of inline) {
      const known = this.refByDataUrl.get(dataUrl);
      if (known && (await idbHasMedia(known.slice(LOCAL_PREFIX.length)))) continue;
      if (known) this.forget(known);
      const ref = `${LOCAL_PREFIX}${createId()}`;
      await idbPutMedia(ref.slice(LOCAL_PREFIX.length), dataUrl);
      this.remember(ref, dataUrl);
    }
    if (inline.size === 0) return;
    mapMediaUrls(state, (url) =>
      url?.startsWith("data:") ? (this.refByDataUrl.get(url) ?? url) : url,
    );
  }

  private async deleteUnreferencedMedia(before: Set<string>, after: Set<string>): Promise<void> {
    for (const ref of before) {
      if (after.has(ref)) continue;
      await idbDeleteMedia(ref.slice(LOCAL_PREFIX.length));
      this.forget(ref);
    }
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

  /* ------------------------------ workspace ----------------------------- */

  async loadSnapshot(): Promise<WorkspaceSnapshot> {
    if (demoSessionVariant() === "pending") return pendingPreviewSnapshot();
    // The team list is owner-only data (Team page), not part of the snapshot.
    const snapshot: Partial<DemoState> = structuredClone(await this.read());
    delete snapshot.team;
    return snapshot as WorkspaceSnapshot;
  }

  async updateUser(patch: Partial<Pick<User, "displayName" | "avatarUrl">>): Promise<User> {
    return this.write((state) => {
      state.user = { ...state.user, ...patch, updatedAt: now() };
      return structuredClone(state.user);
    });
  }

  async createClient(
    input: Omit<Client, "id" | "ownerId" | "slug" | "createdAt" | "updatedAt">,
  ): Promise<Client> {
    return this.write((state) => {
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
      return structuredClone(client);
    });
  }

  async updateClient(id: string, patch: Partial<Client>): Promise<Client> {
    return this.write((state) => {
      const client = state.clients.find((c) => c.id === id);
      if (!client) throw new Error("Client not found");
      Object.assign(client, patch, { id: client.id, updatedAt: now() });
      return structuredClone(client);
    });
  }

  async duplicateClient(id: string): Promise<Client> {
    return this.write((state) => {
      const source = state.clients.find((c) => c.id === id);
      if (!source) throw new Error("Client not found");
      const timestamp = now();
      const copy: Client = {
        ...source,
        id: createId(),
        // Same trimming as the duplicate_client SQL function (120 / 60 limits).
        name: `${source.name.slice(0, 115)} copy`,
        slug: slugify(`${source.name}-copy`),
        instagramUsername: `${source.instagramUsername.slice(0, 55)}.copy`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.clients.push(copy);

      // The copy shares the source's media refs; media is only deleted once
      // nothing references it any more.
      const idMap = new Map<string, string>();
      for (const highlight of state.highlights.filter((h) => h.clientId === id)) {
        state.highlights.push({ ...highlight, id: createId(), clientId: copy.id });
      }
      for (const post of state.posts.filter((p) => p.clientId === id)) {
        const newPostId = createId();
        idMap.set(post.id, newPostId);
        state.posts.push({ ...post, id: newPostId, clientId: copy.id });
      }
      for (const media of [...state.media]) {
        const newPostId = idMap.get(media.postId);
        if (newPostId) state.media.push({ ...media, id: createId(), postId: newPostId });
      }
      return structuredClone(copy);
    });
  }

  async deleteClient(id: string): Promise<void> {
    await this.write((state) => {
      if (state.user.role !== "owner") throw new Error(TEAM_ERRORS.deleteClient);
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
    });
  }

  async createHighlight(
    input: Omit<Highlight, "id" | "createdAt" | "updatedAt">,
  ): Promise<Highlight> {
    return this.write((state) => {
      const timestamp = now();
      const highlight: Highlight = { ...input, id: createId(), createdAt: timestamp, updatedAt: timestamp };
      state.highlights.push(highlight);
      touchClient(state, input.clientId);
      return structuredClone(highlight);
    });
  }

  async updateHighlight(id: string, patch: Partial<Highlight>): Promise<Highlight> {
    return this.write((state) => {
      const highlight = state.highlights.find((h) => h.id === id);
      if (!highlight) throw new Error("Highlight not found");
      Object.assign(highlight, patch, { id: highlight.id, updatedAt: now() });
      touchClient(state, highlight.clientId);
      return structuredClone(highlight);
    });
  }

  async reorderHighlights(clientId: string, orderedIds: string[]): Promise<void> {
    await this.write((state) => {
      orderedIds.forEach((highlightId, index) => {
        const highlight = state.highlights.find((h) => h.id === highlightId && h.clientId === clientId);
        if (highlight) highlight.position = index;
      });
      touchClient(state, clientId);
    });
  }

  async deleteHighlight(id: string): Promise<void> {
    await this.write((state) => {
      const highlight = state.highlights.find((h) => h.id === id);
      state.highlights = state.highlights.filter((h) => h.id !== id);
      if (highlight) touchClient(state, highlight.clientId);
    });
  }

  async createPost(
    input: Omit<Post, "id" | "createdAt" | "updatedAt">,
    media: Array<Omit<PostMedia, "id" | "postId" | "createdAt">>,
  ): Promise<Post> {
    return this.write((state) => {
      const timestamp = now();
      const post: Post = { ...input, id: createId(), createdAt: timestamp, updatedAt: timestamp };
      state.posts.push(post);
      for (const item of media) {
        state.media.push({ ...item, id: createId(), postId: post.id, createdAt: timestamp });
      }
      touchClient(state, input.clientId);
      return structuredClone(post);
    });
  }

  async updatePost(id: string, patch: Partial<Post>): Promise<Post> {
    return this.write((state) => {
      const post = state.posts.find((p) => p.id === id);
      if (!post) throw new Error("Post not found");
      Object.assign(post, patch, { id: post.id, updatedAt: now() });
      touchClient(state, post.clientId);
      return structuredClone(post);
    });
  }

  async setPostMedia(
    postId: string,
    media: Array<Omit<PostMedia, "id" | "postId" | "createdAt"> & { id?: string }>,
  ): Promise<PostMedia[]> {
    return this.write((state) => {
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
        touchClient(state, post.clientId);
      }
      return structuredClone(records);
    });
  }

  async reorderPosts(clientId: string, orderedIds: string[]): Promise<void> {
    await this.write((state) => {
      orderedIds.forEach((postId, index) => {
        const post = state.posts.find((p) => p.id === postId && p.clientId === clientId);
        if (post) post.gridPosition = index;
      });
      touchClient(state, clientId);
    });
  }

  async deletePost(id: string): Promise<void> {
    await this.write((state) => {
      const post = state.posts.find((p) => p.id === id);
      state.posts = state.posts.filter((p) => p.id !== id);
      state.media = state.media.filter((m) => m.postId !== id);
      state.comments = state.comments.filter((c) => c.postId !== id);
      state.approvals = state.approvals.filter((a) => a.postId !== id);
      state.notifications = state.notifications.filter((n) => n.postId !== id);
      if (post) touchClient(state, post.clientId);
    });
  }

  async createComment(input: Omit<Comment, "id" | "createdAt">): Promise<Comment> {
    return this.write((state) => structuredClone(addComment(state, input)));
  }

  async setCommentResolved(id: string, resolved: boolean): Promise<Comment> {
    return this.write((state) => {
      const comment = state.comments.find((c) => c.id === id);
      if (!comment) throw new Error("Comment not found");
      comment.resolved = resolved;
      return structuredClone(comment);
    });
  }

  async recordApproval(
    input: Omit<Approval, "id" | "createdAt" | "updatedAt">,
  ): Promise<Approval> {
    return this.write((state) => structuredClone(addApproval(state, input)));
  }

  async createShareLink(input: Omit<ShareLink, "id" | "token" | "createdAt">): Promise<ShareLink> {
    return this.write((state) => {
      const link: ShareLink = { ...input, id: createId(), token: createToken(), createdAt: now() };
      state.shareLinks.push(link);
      return structuredClone(link);
    });
  }

  async updateShareLink(id: string, patch: Partial<ShareLink>): Promise<ShareLink> {
    return this.write((state) => {
      const link = state.shareLinks.find((s) => s.id === id);
      if (!link) throw new Error("Share link not found");
      Object.assign(link, patch, { id: link.id });
      return structuredClone(link);
    });
  }

  async regenerateShareToken(id: string): Promise<ShareLink> {
    return this.updateShareLink(id, { token: createToken() });
  }

  async deleteShareLink(id: string): Promise<void> {
    await this.write((state) => {
      if (!state.shareLinks.some((s) => s.id === id)) throw new Error("Share link not found");
      state.shareLinks = state.shareLinks.filter((s) => s.id !== id);
    });
    this.shareSubmissions.delete(id);
  }

  async recordActivity(input: Omit<Activity, "id" | "createdAt">): Promise<Activity> {
    return this.write((state) => structuredClone(addActivity(state, input)));
  }

  async markNotificationRead(id: string): Promise<void> {
    const current = await this.read();
    if (!current.notifications.some((n) => n.id === id && !n.isRead)) return;
    await this.write((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (notification) notification.isRead = true;
      purgeReadNotifications(state);
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    const current = await this.read();
    if (!current.notifications.some((n) => !n.isRead)) return;
    await this.write((state) => {
      for (const notification of state.notifications) notification.isRead = true;
      purgeReadNotifications(state);
    });
  }

  /* --------------------------------- team -------------------------------- */

  async listTeam(): Promise<TeamMember[]> {
    const state = await this.read();
    requireOwner(state);
    return structuredClone(
      [...state.team].sort(
        (a, b) => teamOrder(a) - teamOrder(b) || b.createdAt.localeCompare(a.createdAt),
      ),
    );
  }

  async approveMember(userId: string): Promise<void> {
    await this.write((state) => {
      const member = findMember(state, userId, ["pending"], TEAM_ERRORS.notPending);
      member.status = "approved";
      member.approvedAt = now();
      resolveSignup(state, userId);
    });
  }

  async rejectMember(userId: string): Promise<void> {
    await this.write((state) => {
      findMember(state, userId, ["pending"], TEAM_ERRORS.notPending);
      // Like deleting the account: gone from the team, with its sign-up notice.
      state.team = state.team.filter((m) => m.id !== userId);
      resolveSignup(state, userId);
    });
  }

  async suspendMember(userId: string): Promise<void> {
    await this.write((state) => {
      findMember(state, userId, ["approved"], TEAM_ERRORS.notMember).status = "suspended";
    });
  }

  async restoreMember(userId: string): Promise<void> {
    await this.write((state) => {
      const member = findMember(state, userId, ["suspended"], TEAM_ERRORS.notSuspended);
      member.status = "approved";
      member.approvedAt ??= now();
    });
  }

  async removeMember(userId: string): Promise<void> {
    await this.write((state) => {
      findMember(state, userId, ["approved", "suspended"], TEAM_ERRORS.notMember);
      // Like the 0011 delete trigger: their clients move to the owner.
      for (const client of state.clients) {
        if (client.ownerId === userId) client.ownerId = state.user.id;
      }
      state.team = state.team.filter((m) => m.id !== userId);
      resolveSignup(state, userId);
    });
  }

  /* -------------------------------- media ------------------------------- */

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
    this.remember(`${LOCAL_PREFIX}${mediaId}`, dataUrl);
    const size = file.type.startsWith("image/")
      ? await readImageSize(dataUrl)
      : { width: null, height: null };
    onProgress?.(1);
    return { url: `${LOCAL_PREFIX}${mediaId}`, ...size };
  }

  async resolveMediaUrl(url: string): Promise<string> {
    if (!url.startsWith(LOCAL_PREFIX)) return url;
    const cached = this.dataUrlByRef.get(url);
    if (cached) return cached;
    const stored = await idbGetMedia(url.slice(LOCAL_PREFIX.length));
    if (!stored) throw new Error("Stored media missing");
    this.remember(url, stored);
    return stored;
  }

  /* ---------------------------- public sharing -------------------------- */

  async resolveShareToken(token: string): Promise<ShareResolution | ShareError> {
    const state = await this.read();
    const link = findValidShare(state, token);
    if (typeof link === "string") return link;
    const bundle = reviewerBundle(state, link.clientId);
    if (!bundle) return "not_found";
    return { shareLink: structuredClone(link), bundle };
  }

  async submitPublicComment(
    token: string,
    input: Omit<Comment, "id" | "createdAt" | "resolved" | "commentType">,
  ): Promise<Comment | ShareError> {
    // Refusals are decided on the cached state so they never write; the
    // locked write re-checks against the latest state.
    const precheck = checkSubmission(await this.read(), token, input.postId, "allowComments");
    if (typeof precheck === "string") return precheck;
    if (!this.takeShareSubmission(precheck.link.id)) return "rate_limited";
    return this.write((state) => {
      const checked = checkSubmission(state, token, input.postId, "allowComments");
      if (typeof checked === "string") return checked;
      const { link, post } = checked;
      const comment = addComment(state, { ...input, commentType: "general", resolved: false });
      addNotification(state, {
        clientId: link.clientId,
        postId: post.id,
        type: "review_feedback_received",
        title: `${input.authorName} left feedback`,
        message: input.body,
      });
      addActivity(state, {
        clientId: link.clientId,
        type: "comment_received",
        description: `${input.authorName} left a comment`,
      });
      return { ...structuredClone(comment), authorEmail: null };
    });
  }

  async submitPublicApproval(
    token: string,
    input: Omit<Approval, "id" | "createdAt" | "updatedAt" | "clientId">,
  ): Promise<Approval | ShareError> {
    const precheck = checkSubmission(await this.read(), token, input.postId, "allowApproval");
    if (typeof precheck === "string") return precheck;
    // One submission covers the approval and its companion comment.
    if (!this.takeShareSubmission(precheck.link.id)) return "rate_limited";
    return this.write((state) => {
      const checked = checkSubmission(state, token, input.postId, "allowApproval");
      if (typeof checked === "string") return checked;
      const { link, post } = checked;
      const message = input.message?.trim() || null;
      const approval = addApproval(state, { ...input, message, clientId: link.clientId });
      // The message also joins the post's comment thread unless comments are
      // off (it is kept on the approval either way). Its owner notification
      // is the approval's own, below.
      if (message && link.allowComments) {
        addComment(state, {
          postId: post.id,
          authorName: input.reviewerName,
          authorEmail: input.reviewerEmail,
          body: message,
          commentType: input.status === "changes_requested" ? "change_request" : "general",
          resolved: false,
        });
      }
      addNotification(state, {
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
      addActivity(state, {
        clientId: link.clientId,
        type: input.status === "approved" ? "approval_received" : "changes_requested",
        description: `${input.reviewerName} ${
          input.status === "approved" ? "approved a post" : "requested changes on a post"
        }`,
      });
      return { ...structuredClone(approval), reviewerEmail: null };
    });
  }

  /* --------------------------------- demo -------------------------------- */

  async resetDemoData(seed: boolean): Promise<void> {
    await withWriteLock(async () => {
      await idbClearAll();
      this.dataUrlByRef.clear();
      this.refByDataUrl.clear();
      const state: DemoState = seed
        ? { ...createSeedSnapshot(), team: createSeedTeam() }
        : { ...createEmptySnapshot(), team: createEmptyTeam() };
      await idbPutState(state);
      this.cache = state;
      announceWorkspaceChange();
    });
  }
}
