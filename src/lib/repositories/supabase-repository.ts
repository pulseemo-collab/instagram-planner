"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { createId, createToken, slugify } from "@/lib/id";
import type {
  Activity,
  AppNotification,
  Approval,
  Client,
  Comment,
  Highlight,
  Post,
  PostMedia,
  ShareLink,
  User,
} from "@/types/domain";
import type {
  Repository,
  ShareError,
  ShareResolution,
  UploadResult,
  WorkspaceSnapshot,
} from "./types";

/* ----------------------------- row mappers ------------------------------ */

type Row = Record<string, unknown>;

const asStr = (v: unknown): string => String(v ?? "");
const asStrOrNull = (v: unknown): string | null => (v == null ? null : String(v));
const asNum = (v: unknown): number => Number(v ?? 0);
const asNumOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const asBool = (v: unknown): boolean => Boolean(v);

function mapUser(row: Row): User {
  return {
    id: asStr(row.id),
    email: asStr(row.email),
    displayName: asStr(row.display_name),
    avatarUrl: asStrOrNull(row.avatar_url),
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
  };
}

function mapClient(row: Row): Client {
  return {
    id: asStr(row.id),
    ownerId: asStr(row.owner_id),
    name: asStr(row.name),
    slug: asStr(row.slug),
    instagramUsername: asStr(row.instagram_username),
    profileName: asStr(row.profile_name),
    avatarUrl: asStrOrNull(row.avatar_url),
    category: asStrOrNull(row.category),
    bio: asStr(row.bio),
    website: asStrOrNull(row.website),
    threadsUsername: asStrOrNull(row.threads_username),
    note: asStrOrNull(row.note),
    isPrivate: asBool(row.is_private),
    isVerified: asBool(row.is_verified),
    accountType: asStr(row.account_type) as Client["accountType"],
    postsCount: asNum(row.posts_count),
    followersCount: asNum(row.followers_count),
    followingCount: asNum(row.following_count),
    theme: asStr(row.theme) as Client["theme"],
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
  };
}

function clientToRow(patch: Partial<Client>): Row {
  const row: Row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.instagramUsername !== undefined) row.instagram_username = patch.instagramUsername;
  if (patch.profileName !== undefined) row.profile_name = patch.profileName;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.website !== undefined) row.website = patch.website;
  if (patch.threadsUsername !== undefined) row.threads_username = patch.threadsUsername;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.isPrivate !== undefined) row.is_private = patch.isPrivate;
  if (patch.isVerified !== undefined) row.is_verified = patch.isVerified;
  if (patch.accountType !== undefined) row.account_type = patch.accountType;
  if (patch.postsCount !== undefined) row.posts_count = patch.postsCount;
  if (patch.followersCount !== undefined) row.followers_count = patch.followersCount;
  if (patch.followingCount !== undefined) row.following_count = patch.followingCount;
  if (patch.theme !== undefined) row.theme = patch.theme;
  return row;
}

function mapHighlight(row: Row): Highlight {
  return {
    id: asStr(row.id),
    clientId: asStr(row.client_id),
    title: asStr(row.title),
    coverUrl: asStrOrNull(row.cover_url),
    position: asNum(row.position),
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
  };
}

function mapPost(row: Row): Post {
  return {
    id: asStr(row.id),
    clientId: asStr(row.client_id),
    name: asStr(row.name),
    stage: (asStr(row.stage) || "post") as Post["stage"],
    type: asStr(row.type) as Post["type"],
    caption: asStr(row.caption),
    location: asStrOrNull(row.location),
    altText: asStrOrNull(row.alt_text),
    hashtags: Array.isArray(row.hashtags) ? row.hashtags.map(String) : [],
    status: asStr(row.status) as Post["status"],
    approvalStatus: asStr(row.approval_status) as Post["approvalStatus"],
    scheduledAt: asStrOrNull(row.scheduled_at),
    scheduledDay: asStrOrNull(row.scheduled_day),
    publishedAt: asStrOrNull(row.published_at),
    isPinned: asBool(row.is_pinned),
    gridPosition: asNum(row.grid_position),
    likesCount: asNum(row.likes_count),
    commentsCount: asNum(row.comments_count),
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
  };
}

function postToRow(patch: Partial<Post>): Row {
  const row: Row = {};
  if (patch.clientId !== undefined) row.client_id = patch.clientId;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.stage !== undefined) row.stage = patch.stage;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.caption !== undefined) row.caption = patch.caption;
  if (patch.location !== undefined) row.location = patch.location;
  if (patch.altText !== undefined) row.alt_text = patch.altText;
  if (patch.hashtags !== undefined) row.hashtags = patch.hashtags;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.approvalStatus !== undefined) row.approval_status = patch.approvalStatus;
  if (patch.scheduledAt !== undefined) row.scheduled_at = patch.scheduledAt;
  if (patch.scheduledDay !== undefined) row.scheduled_day = patch.scheduledDay;
  if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;
  if (patch.isPinned !== undefined) row.is_pinned = patch.isPinned;
  if (patch.gridPosition !== undefined) row.grid_position = patch.gridPosition;
  if (patch.likesCount !== undefined) row.likes_count = patch.likesCount;
  if (patch.commentsCount !== undefined) row.comments_count = patch.commentsCount;
  return row;
}

function mapMedia(row: Row): PostMedia {
  return {
    id: asStr(row.id),
    postId: asStr(row.post_id),
    mediaType: asStr(row.media_type) as PostMedia["mediaType"],
    url: asStr(row.url),
    thumbnailUrl: asStrOrNull(row.thumbnail_url),
    coverSource: asStrOrNull(row.cover_source) as PostMedia["coverSource"],
    coverTimestamp: asNumOrNull(row.cover_timestamp),
    width: asNumOrNull(row.width),
    height: asNumOrNull(row.height),
    position: asNum(row.position),
    createdAt: asStr(row.created_at),
  };
}

function mapComment(row: Row): Comment {
  return {
    id: asStr(row.id),
    postId: asStr(row.post_id),
    authorName: asStr(row.author_name),
    authorEmail: asStrOrNull(row.author_email),
    body: asStr(row.body),
    commentType: asStr(row.comment_type) as Comment["commentType"],
    resolved: asBool(row.resolved),
    createdAt: asStr(row.created_at),
  };
}

function mapApproval(row: Row): Approval {
  return {
    id: asStr(row.id),
    clientId: asStr(row.client_id),
    postId: asStr(row.post_id),
    reviewerName: asStr(row.reviewer_name),
    reviewerEmail: asStrOrNull(row.reviewer_email),
    status: asStr(row.status) as Approval["status"],
    message: asStrOrNull(row.message),
    createdAt: asStr(row.created_at),
    updatedAt: asStr(row.updated_at),
  };
}

function mapShareLink(row: Row): ShareLink {
  return {
    id: asStr(row.id),
    clientId: asStr(row.client_id),
    token: asStr(row.token),
    isActive: asBool(row.is_active),
    expiresAt: asStrOrNull(row.expires_at),
    allowComments: asBool(row.allow_comments),
    allowApproval: asBool(row.allow_approval),
    createdAt: asStr(row.created_at),
  };
}

function mapNotification(row: Row): AppNotification {
  return {
    id: asStr(row.id),
    recipientId: asStr(row.recipient_id),
    clientId: asStr(row.client_id),
    postId: asStrOrNull(row.post_id),
    type: asStr(row.type) as AppNotification["type"],
    title: asStr(row.title),
    message: asStr(row.message),
    isRead: asBool(row.is_read),
    createdAt: asStr(row.created_at),
  };
}

function mapActivity(row: Row): Activity {
  return {
    id: asStr(row.id),
    clientId: asStr(row.client_id),
    type: asStr(row.type) as Activity["type"],
    description: asStr(row.description),
    createdAt: asStr(row.created_at),
  };
}

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const MEDIA_BUCKETS = ["avatars", "highlights", "post-media"] as const;

/** Error codes raised by the 0006 share RPCs, mapped to repository errors. */
const SHARE_RPC_ERRORS: Record<string, ShareError> = {
  not_found: "not_found",
  inactive: "inactive",
  expired: "expired",
  comments_disabled: "inactive",
  approvals_disabled: "inactive",
  rate_limited: "rate_limited",
};

function shareErrorFrom(error: { message: string }): ShareError | null {
  return SHARE_RPC_ERRORS[error.message] ?? null;
}

/** Known share refusals become a ShareError; anything else is a real failure. */
function shareErrorOrThrow(error: { message: string }): ShareError {
  const shareError = shareErrorFrom(error);
  if (!shareError) throw new Error(error.message);
  return shareError;
}

/* ------------------------------ repository ------------------------------ */

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;

  private get sb(): SupabaseClient {
    return getBrowserSupabase();
  }

  /* -------------------------- storage cleanup --------------------------- */

  /** Bucket + object path of one of this project's public Storage URLs. */
  private storageObject(url: string | null | undefined): { bucket: string; path: string } | null {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
    if (!url || !url.startsWith(base)) return null;
    const rest = url.slice(base.length);
    const slash = rest.indexOf("/");
    const bucket = rest.slice(0, slash);
    if (slash < 0 || !(MEDIA_BUCKETS as readonly string[]).includes(bucket)) return null;
    return { bucket, path: decodeURIComponent(rest.slice(slash + 1)) };
  }

  /**
   * Best-effort removal of the Storage files that belonged to rows just
   * deleted or replaced. `candidates` are ONLY the URLs those rows held,
   * read before the change — this never lists or sweeps a bucket, so uploads
   * that aren't saved in any row yet (e.g. in progress in another tab) are
   * never touched. A candidate is removed only if:
   * - it is one of this project's media-bucket URLs,
   * - its path is inside the signed-in owner's own folder (`<user id>/…`),
   * - and, re-checked after the change, no row references it any more
   *   (files shared between rows, e.g. a duplicated client, stay).
   * Runs only after the database change succeeded; a failure here never fails
   * the operation, and nothing is removed if the reference check fails.
   */
  private async removeUnreferencedMedia(candidates: Array<string | null | undefined>): Promise<void> {
    try {
      const { data: auth } = await this.sb.auth.getUser();
      const ownerFolder = auth.user ? `${auth.user.id}/` : null;
      if (!ownerFolder) return;
      const urls = [...new Set(candidates)].filter((url): url is string => {
        const object = this.storageObject(url);
        return (
          object !== null && object.path.startsWith(ownerFolder) && !object.path.includes("..")
        );
      });
      for (let start = 0; start < urls.length; start += 40) {
        const chunk = urls.slice(start, start + 40);
        const checks = await Promise.all([
          this.sb.from("profiles").select("url:avatar_url").in("avatar_url", chunk),
          this.sb.from("clients").select("url:avatar_url").in("avatar_url", chunk),
          this.sb.from("highlights").select("url:cover_url").in("cover_url", chunk),
          this.sb.from("post_media").select("url").in("url", chunk),
          this.sb.from("post_media").select("url:thumbnail_url").in("thumbnail_url", chunk),
        ]);
        if (checks.some((check) => check.error)) return;
        const stillUsed = new Set(
          checks.flatMap((check) => ((check.data ?? []) as Row[]).map((row) => String(row.url))),
        );
        // Exact paths only — storage.remove() deletes the listed objects and
        // nothing else (and Storage RLS also limits it to the owner's folder).
        const byBucket = new Map<string, string[]>();
        for (const url of chunk) {
          if (stillUsed.has(url)) continue;
          const object = this.storageObject(url)!;
          byBucket.set(object.bucket, [...(byBucket.get(object.bucket) ?? []), object.path]);
        }
        await Promise.all(
          [...byBucket].map(([bucket, paths]) => this.sb.storage.from(bucket).remove(paths)),
        );
      }
    } catch {
      // Orphaned files only cost storage; never fail the user's action.
    }
  }

  /** Current media URLs of the given posts (cleanup candidates). */
  private async postMediaUrls(postIds: string[]): Promise<string[]> {
    if (!postIds.length) return [];
    const { data } = await this.sb.from("post_media").select("url, thumbnail_url").in("post_id", postIds);
    return ((data ?? []) as Row[]).flatMap((row) => [asStr(row.url), asStrOrNull(row.thumbnail_url) ?? ""]);
  }

  async loadSnapshot(): Promise<WorkspaceSnapshot> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");

    const [profile, clients, notifications] = await Promise.all([
      this.sb.from("profiles").select("*").eq("id", auth.user.id).single(),
      this.sb.from("clients").select("*").order("updated_at", { ascending: false }),
      this.sb
        .from("notifications")
        .select("*")
        .eq("recipient_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    throwIf(profile.error);
    throwIf(clients.error);
    throwIf(notifications.error);

    const clientIds = (clients.data ?? []).map((c) => String((c as Row).id));
    const emptyOk = { data: [] as Row[], error: null };
    const [highlights, posts, comments, approvals, shareLinks, activity] = await Promise.all([
      clientIds.length ? this.sb.from("highlights").select("*").in("client_id", clientIds) : emptyOk,
      clientIds.length ? this.sb.from("posts").select("*").in("client_id", clientIds) : emptyOk,
      clientIds.length
        ? this.sb.from("comments").select("*, posts!inner(client_id)").in("posts.client_id", clientIds)
        : emptyOk,
      clientIds.length ? this.sb.from("approvals").select("*").in("client_id", clientIds) : emptyOk,
      clientIds.length ? this.sb.from("share_links").select("*").in("client_id", clientIds) : emptyOk,
      clientIds.length
        ? this.sb.from("activity").select("*").in("client_id", clientIds).order("created_at", { ascending: false }).limit(200)
        : emptyOk,
    ]);
    for (const result of [highlights, posts, comments, approvals, shareLinks, activity]) {
      throwIf(result.error);
    }

    const postIds = ((posts.data ?? []) as Row[]).map((p) => String(p.id));
    const media = postIds.length
      ? await this.sb.from("post_media").select("*").in("post_id", postIds)
      : emptyOk;
    throwIf(media.error);

    return {
      user: mapUser(profile.data as Row),
      clients: ((clients.data ?? []) as Row[]).map(mapClient),
      highlights: ((highlights.data ?? []) as Row[]).map(mapHighlight),
      posts: ((posts.data ?? []) as Row[]).map(mapPost),
      media: ((media.data ?? []) as Row[]).map(mapMedia),
      comments: ((comments.data ?? []) as Row[]).map(mapComment),
      approvals: ((approvals.data ?? []) as Row[]).map(mapApproval),
      shareLinks: ((shareLinks.data ?? []) as Row[]).map(mapShareLink),
      activity: ((activity.data ?? []) as Row[]).map(mapActivity),
      notifications: ((notifications.data ?? []) as Row[]).map(mapNotification),
    };
  }

  async updateUser(patch: Partial<Pick<User, "displayName" | "avatarUrl">>): Promise<User> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    const row: Row = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    const previous =
      patch.avatarUrl !== undefined
        ? (await this.sb.from("profiles").select("avatar_url").eq("id", auth.user.id).maybeSingle()).data
        : null;
    const { data, error } = await this.sb
      .from("profiles")
      .update(row)
      .eq("id", auth.user.id)
      .select()
      .single();
    throwIf(error);
    await this.removeUnreferencedMedia([asStrOrNull((previous as Row | null)?.avatar_url)]);
    return mapUser(data as Row);
  }

  async createClient(
    input: Omit<Client, "id" | "ownerId" | "slug" | "createdAt" | "updatedAt">,
  ): Promise<Client> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    const row = clientToRow({ ...input, slug: `${slugify(input.name)}-${createId().slice(0, 6)}` });
    row.owner_id = auth.user.id;
    const { data, error } = await this.sb.from("clients").insert(row).select().single();
    throwIf(error);
    return mapClient(data as Row);
  }

  async updateClient(id: string, patch: Partial<Client>): Promise<Client> {
    const previous =
      patch.avatarUrl !== undefined
        ? (await this.sb.from("clients").select("avatar_url").eq("id", id).maybeSingle()).data
        : null;
    const { data, error } = await this.sb
      .from("clients")
      .update(clientToRow(patch))
      .eq("id", id)
      .select()
      .single();
    throwIf(error);
    await this.removeUnreferencedMedia([asStrOrNull((previous as Row | null)?.avatar_url)]);
    return mapClient(data as Row);
  }

  async duplicateClient(id: string): Promise<Client> {
    // One transaction in Postgres (migration 0008): client, highlights, posts
    // and media are copied together or not at all.
    const { data, error } = await this.sb.rpc("duplicate_client", { p_client_id: id });
    throwIf(error);
    return mapClient(data as Row);
  }

  async deleteClient(id: string): Promise<void> {
    // Collect the client's files first; rows cascade away with the delete.
    const [client, highlights, posts] = await Promise.all([
      this.sb.from("clients").select("avatar_url").eq("id", id).maybeSingle(),
      this.sb.from("highlights").select("cover_url").eq("client_id", id),
      this.sb.from("posts").select("id").eq("client_id", id),
    ]);
    const candidates = [
      asStrOrNull((client.data as Row | null)?.avatar_url),
      ...((highlights.data ?? []) as Row[]).map((row) => asStrOrNull(row.cover_url)),
      ...(await this.postMediaUrls(((posts.data ?? []) as Row[]).map((row) => asStr(row.id)))),
    ];
    const { error } = await this.sb.from("clients").delete().eq("id", id);
    throwIf(error);
    await this.removeUnreferencedMedia(candidates);
  }

  async createHighlight(
    input: Omit<Highlight, "id" | "createdAt" | "updatedAt">,
  ): Promise<Highlight> {
    const { data, error } = await this.sb
      .from("highlights")
      .insert({
        client_id: input.clientId,
        title: input.title,
        cover_url: input.coverUrl,
        position: input.position,
      })
      .select()
      .single();
    throwIf(error);
    return mapHighlight(data as Row);
  }

  async updateHighlight(id: string, patch: Partial<Highlight>): Promise<Highlight> {
    const row: Row = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
    if (patch.position !== undefined) row.position = patch.position;
    const previous =
      patch.coverUrl !== undefined
        ? (await this.sb.from("highlights").select("cover_url").eq("id", id).maybeSingle()).data
        : null;
    const { data, error } = await this.sb
      .from("highlights")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    throwIf(error);
    await this.removeUnreferencedMedia([asStrOrNull((previous as Row | null)?.cover_url)]);
    return mapHighlight(data as Row);
  }

  async reorderHighlights(clientId: string, orderedIds: string[]): Promise<void> {
    // One UPDATE statement (migration 0007): the order changes all at once or not at all.
    const { error } = await this.sb.rpc("reorder_highlights", {
      p_client_id: clientId,
      p_ordered_ids: orderedIds,
    });
    throwIf(error);
  }

  async deleteHighlight(id: string): Promise<void> {
    const previous = (await this.sb.from("highlights").select("cover_url").eq("id", id).maybeSingle()).data;
    const { error } = await this.sb.from("highlights").delete().eq("id", id);
    throwIf(error);
    await this.removeUnreferencedMedia([asStrOrNull((previous as Row | null)?.cover_url)]);
  }

  async createPost(
    input: Omit<Post, "id" | "createdAt" | "updatedAt">,
    media: Array<Omit<PostMedia, "id" | "postId" | "createdAt">>,
  ): Promise<Post> {
    const { data, error } = await this.sb.from("posts").insert(postToRow(input)).select().single();
    throwIf(error);
    const post = mapPost(data as Row);
    if (media.length) {
      const { error: mediaError } = await this.sb.from("post_media").insert(
        media.map((m, index) => ({
          post_id: post.id,
          media_type: m.mediaType,
          url: m.url,
          thumbnail_url: m.thumbnailUrl,
          cover_source: m.coverSource ?? null,
          cover_timestamp: m.coverTimestamp ?? null,
          width: m.width,
          height: m.height,
          position: index,
        })),
      );
      if (mediaError) {
        // Don't leave a post without its media behind.
        await this.sb.from("posts").delete().eq("id", post.id);
        throw new Error(mediaError.message);
      }
    }
    return post;
  }

  async updatePost(id: string, patch: Partial<Post>): Promise<Post> {
    const { data, error } = await this.sb
      .from("posts")
      .update(postToRow(patch))
      .eq("id", id)
      .select()
      .single();
    throwIf(error);
    return mapPost(data as Row);
  }

  async setPostMedia(
    postId: string,
    media: Array<Omit<PostMedia, "id" | "postId" | "createdAt"> & { id?: string }>,
  ): Promise<PostMedia[]> {
    const previous = await this.postMediaUrls([postId]);
    // Delete + insert in ONE transaction (migration 0007): a failure leaves
    // the existing media untouched instead of a post with no media.
    const { data, error } = await this.sb.rpc("set_post_media", {
      p_post_id: postId,
      p_media: media.map((m) => ({
        media_type: m.mediaType,
        url: m.url,
        thumbnail_url: m.thumbnailUrl,
        cover_source: m.coverSource ?? null,
        cover_timestamp: m.coverTimestamp ?? null,
        width: m.width,
        height: m.height,
      })),
    });
    throwIf(error);
    // Files kept in the new list are still referenced and therefore stay.
    await this.removeUnreferencedMedia(previous);
    return ((data ?? []) as Row[]).map(mapMedia);
  }

  async reorderPosts(clientId: string, orderedIds: string[]): Promise<void> {
    const { error } = await this.sb.rpc("reorder_posts", {
      p_client_id: clientId,
      p_ordered_ids: orderedIds,
    });
    throwIf(error);
  }

  async deletePost(id: string): Promise<void> {
    const previous = await this.postMediaUrls([id]);
    const { error } = await this.sb.from("posts").delete().eq("id", id);
    throwIf(error);
    await this.removeUnreferencedMedia(previous);
  }

  async createComment(input: Omit<Comment, "id" | "createdAt">): Promise<Comment> {
    const { data, error } = await this.sb
      .from("comments")
      .insert({
        post_id: input.postId,
        author_name: input.authorName,
        author_email: input.authorEmail,
        body: input.body,
        comment_type: input.commentType,
        resolved: input.resolved,
      })
      .select()
      .single();
    throwIf(error);
    return mapComment(data as Row);
  }

  async setCommentResolved(id: string, resolved: boolean): Promise<Comment> {
    const { data, error } = await this.sb
      .from("comments")
      .update({ resolved })
      .eq("id", id)
      .select()
      .single();
    throwIf(error);
    return mapComment(data as Row);
  }

  async recordApproval(
    input: Omit<Approval, "id" | "createdAt" | "updatedAt">,
  ): Promise<Approval> {
    const { data, error } = await this.sb
      .from("approvals")
      .insert({
        client_id: input.clientId,
        post_id: input.postId,
        reviewer_name: input.reviewerName,
        reviewer_email: input.reviewerEmail,
        status: input.status,
        message: input.message,
      })
      .select()
      .single();
    throwIf(error);
    // The approvals trigger (migration 0007) moves the post's approval_status
    // in the same statement, so the two can't disagree.
    return mapApproval(data as Row);
  }

  async createShareLink(input: Omit<ShareLink, "id" | "token" | "createdAt">): Promise<ShareLink> {
    const { data, error } = await this.sb
      .from("share_links")
      .insert({
        client_id: input.clientId,
        token: createToken(),
        is_active: input.isActive,
        expires_at: input.expiresAt,
        allow_comments: input.allowComments,
        allow_approval: input.allowApproval,
      })
      .select()
      .single();
    throwIf(error);
    return mapShareLink(data as Row);
  }

  async updateShareLink(id: string, patch: Partial<ShareLink>): Promise<ShareLink> {
    const row: Row = {};
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;
    if (patch.allowComments !== undefined) row.allow_comments = patch.allowComments;
    if (patch.allowApproval !== undefined) row.allow_approval = patch.allowApproval;
    if (patch.token !== undefined) row.token = patch.token;
    const { data, error } = await this.sb
      .from("share_links")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    throwIf(error);
    return mapShareLink(data as Row);
  }

  async regenerateShareToken(id: string): Promise<ShareLink> {
    return this.updateShareLink(id, { token: createToken() });
  }

  async recordActivity(input: Omit<Activity, "id" | "createdAt">): Promise<Activity> {
    const { data, error } = await this.sb
      .from("activity")
      .insert({ client_id: input.clientId, type: input.type, description: input.description })
      .select()
      .single();
    throwIf(error);
    return mapActivity(data as Row);
  }

  async markNotificationRead(id: string): Promise<void> {
    // RLS restricts the update to the caller's own notifications.
    const { error } = await this.sb.from("notifications").update({ is_read: true }).eq("id", id);
    throwIf(error);
  }

  async markAllNotificationsRead(): Promise<void> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    const { error } = await this.sb
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", auth.user.id)
      .eq("is_read", false);
    throwIf(error);
  }

  async uploadFile(
    file: File,
    bucket: "avatars" | "highlights" | "post-media",
    onProgress?: (fraction: number) => void,
  ): Promise<UploadResult> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    onProgress?.(0.1);
    // ORIGINAL MEDIA RULE: the File object is passed straight to Storage —
    // no canvas, no re-encode, no base64, no thumbnails. The original
    // filename is preserved inside a unique folder (uuid prevents collisions
    // without renaming the file); only characters that are invalid in storage
    // object keys are replaced.
    const safeName = file.name.replace(/[^\w.\-() ]/g, "_") || "file";
    const path = `${auth.user.id}/${createId()}/${safeName}`;
    const { error } = await this.sb.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    throwIf(error);
    onProgress?.(0.9);
    const { data } = this.sb.storage.from(bucket).getPublicUrl(path);
    let width: number | null = null;
    let height: number | null = null;
    if (file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      try {
        const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error("bad image"));
          img.src = objectUrl;
        });
        width = size.w;
        height = size.h;
      } catch {
        // dimensions stay null
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
    onProgress?.(1);
    return { url: data.publicUrl, width, height };
  }

  async resolveMediaUrl(url: string): Promise<string> {
    return url; // Supabase URLs are directly displayable.
  }

  /**
   * Dedicated anonymous client for public share requests. Never the cached
   * browser singleton: that one may carry the owner's session (which would
   * widen what RLS returns). Share access goes exclusively through the
   * SECURITY DEFINER RPCs from migration 0006, which take the token as an
   * argument — no request headers involved.
   */
  private publicClient: SupabaseClient | null = null;

  private get shareSb(): SupabaseClient {
    if (!this.publicClient) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Supabase is not configured");
      this.publicClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "gridline-share-anon",
        },
      });
    }
    return this.publicClient;
  }

  async resolveShareToken(token: string): Promise<ShareResolution | ShareError> {
    const { data, error } = await this.shareSb.rpc("resolve_share", { share_token: token });
    if (error) return shareErrorFrom(error) ?? "not_found";
    const payload = data as {
      link: Row;
      client: Row | null;
      highlights: Row[];
      posts: Row[];
      media: Row[];
      comments: Row[];
      approvals: Row[];
    } | null;
    if (!payload?.client) return "not_found";

    return {
      shareLink: mapShareLink({ ...payload.link, token }),
      bundle: {
        client: mapClient(payload.client),
        highlights: payload.highlights.map(mapHighlight),
        posts: payload.posts.map(mapPost),
        media: payload.media.map(mapMedia),
        comments: payload.comments.map(mapComment),
        approvals: payload.approvals.map(mapApproval),
        shareLinks: [],
      },
    };
  }

  async submitPublicComment(
    token: string,
    input: Omit<Comment, "id" | "createdAt" | "resolved" | "commentType">,
  ): Promise<Comment | ShareError> {
    const { data, error } = await this.shareSb.rpc("submit_share_comment", {
      share_token: token,
      p_post_id: input.postId,
      p_author_name: input.authorName,
      p_author_email: input.authorEmail,
      p_body: input.body,
    });
    if (error) return shareErrorOrThrow(error);
    return mapComment(data as Row);
  }

  async submitPublicApproval(
    token: string,
    input: Omit<Approval, "id" | "createdAt" | "updatedAt" | "clientId">,
  ): Promise<Approval | ShareError> {
    const { data, error } = await this.shareSb.rpc("submit_share_approval", {
      share_token: token,
      p_post_id: input.postId,
      p_reviewer_name: input.reviewerName,
      p_reviewer_email: input.reviewerEmail,
      p_status: input.status,
      p_message: input.message,
    });
    if (error) return shareErrorOrThrow(error);
    return mapApproval(data as Row);
  }
}
