import type { WorkspaceSnapshot } from "@/lib/repositories/types";
import type { Client, Comment, Post, PostMedia } from "@/types/domain";

/** Small, explicit domain objects for unit tests (override what matters). */

export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    ownerId: "u1",
    name: "Client One",
    slug: "client-one",
    instagramUsername: "client.one",
    profileName: "Client One",
    avatarUrl: null,
    category: null,
    bio: "",
    website: null,
    threadsUsername: null,
    note: null,
    isPrivate: false,
    isVerified: false,
    accountType: "business",
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    theme: "light",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "p1",
    clientId: "c1",
    name: "Post",
    stage: "post",
    type: "image",
    caption: "",
    location: null,
    altText: null,
    hashtags: [],
    status: "draft",
    approvalStatus: "not_sent",
    scheduledAt: null,
    scheduledDay: null,
    publishedAt: null,
    isPinned: false,
    gridPosition: 0,
    likesCount: 0,
    commentsCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeMedia(overrides: Partial<PostMedia> = {}): PostMedia {
  return {
    id: "m1",
    postId: "p1",
    mediaType: "image",
    url: "https://cdn.example/a.jpg",
    thumbnailUrl: null,
    width: 1080,
    height: 1350,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "cm1",
    postId: "p1",
    authorName: "Rita",
    authorEmail: null,
    body: "Nice",
    commentType: "general",
    resolved: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    user: {
      id: "u1",
      email: "owner@example.com",
      displayName: "Owner",
      avatarUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    clients: [],
    highlights: [],
    posts: [],
    media: [],
    comments: [],
    approvals: [],
    shareLinks: [],
    activity: [],
    notifications: [],
    ...overrides,
  };
}
