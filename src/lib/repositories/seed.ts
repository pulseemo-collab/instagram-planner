import type { WorkspaceSnapshot } from "./types";
import type { Activity, Approval, Client, Comment, Highlight, Post, PostMedia, ShareLink } from "@/types/domain";

/**
 * Demo seed. Media uses `gradient:` placeholder URIs (from/via/to/angle) so
 * nothing depends on remote images; uploads replace these with real files.
 */

const DEMO_USER_ID = "user-demo";

function daysAgo(n: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

function daysAhead(n: number, hour = 18): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function g(from: string, via: string, to: string, angle = 150): string {
  return `gradient:${from}/${via}/${to}/${angle}`;
}

type PostSeed = Omit<Post, "clientId" | "createdAt" | "updatedAt"> & { createdAgo: number };
type MediaSeed = Omit<PostMedia, "createdAt">;

function buildPosts(clientId: string, seeds: PostSeed[]): Post[] {
  return seeds.map(({ createdAgo, ...seed }) => ({
    ...seed,
    clientId,
    createdAt: daysAgo(createdAgo),
    updatedAt: daysAgo(Math.max(createdAgo - 1, 0)),
  }));
}

function buildMedia(seeds: MediaSeed[]): PostMedia[] {
  return seeds.map((seed) => ({ ...seed, createdAt: daysAgo(3) }));
}

/* ------------------------------------------------------------------ */
/* Maison Aurelle — jewelry house                                      */
/* ------------------------------------------------------------------ */

const aurelle: Client = {
  id: "client-aurelle",
  ownerId: DEMO_USER_ID,
  name: "Maison Aurelle",
  slug: "maison-aurelle",
  instagramUsername: "maisonaurelle",
  profileName: "Maison Aurelle",
  avatarUrl: g("#f3e7d3", "#d9be93", "#8a7354", 140),
  category: "Jewelry/Watches",
  bio: "Fine jewelry, made slowly in Lyon\nRecycled gold · lab-grown stones\nHéritage collection — out now ↓",
  website: "maisonaurelle.com/heritage",
  threadsUsername: "maisonaurelle",
  note: "New drop 8/1",
  isPrivate: false,
  isVerified: true,
  accountType: "business",
  postsCount: 128,
  followersCount: 24_312,
  followingCount: 812,
  theme: "light",
  createdAt: daysAgo(40),
  updatedAt: daysAgo(0, 8),
};

const aurelleHighlights: Highlight[] = [
  { id: "hl-a1", clientId: aurelle.id, title: "Héritage", coverUrl: g("#e9d9bd", "#c2a377", "#6d5a3a", 155), position: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { id: "hl-a2", clientId: aurelle.id, title: "Atelier", coverUrl: g("#ece5d8", "#b7a98c", "#4f4632", 130), position: 1, createdAt: daysAgo(28), updatedAt: daysAgo(28) },
  { id: "hl-a3", clientId: aurelle.id, title: "Press", coverUrl: g("#f4f0e8", "#d4cbb8", "#8d8672", 160), position: 2, createdAt: daysAgo(25), updatedAt: daysAgo(25) },
  { id: "hl-a4", clientId: aurelle.id, title: "On you", coverUrl: g("#e6d2c3", "#c09a7c", "#6e4f3a", 145), position: 3, createdAt: daysAgo(20), updatedAt: daysAgo(20) },
];

const aurellePosts = buildPosts(aurelle.id, [
  { id: "post-a1", name: "Héritage signet", stage: "post", type: "image", caption: "The Héritage signet, cast from a single ribbon of recycled gold. Photographed at the atelier, morning light.", location: "Lyon, France", altText: "Gold signet ring on linen", hashtags: ["finejewelry", "recycledgold", "heritage"], status: "scheduled", approvalStatus: "awaiting_approval", scheduledAt: daysAhead(1, 12), publishedAt: null, isPinned: true, gridPosition: 0, likesCount: 1843, commentsCount: 62, createdAgo: 9 },
  { id: "post-a2", name: "Héritage solitaire steps", stage: "post", type: "carousel", caption: "Five stones, one setting. Swipe to see how the Héritage solitaire comes together — from rough cut to final polish.", location: "Lyon, France", altText: "Carousel of gemstone setting process", hashtags: ["labgrown", "atelier", "behindthescenes"], status: "scheduled", approvalStatus: "approved", scheduledAt: daysAhead(3, 12), publishedAt: null, isPinned: true, gridPosition: 1, likesCount: 2210, commentsCount: 84, createdAgo: 8 },
  { id: "post-a3", name: "Atelier 48h reel", stage: "post", type: "reel", caption: "48 hours in the atelier, compressed into 40 seconds.", location: null, altText: null, hashtags: ["atelier", "goldsmith"], status: "scheduled", approvalStatus: "awaiting_approval", scheduledAt: daysAhead(5, 17), publishedAt: null, isPinned: false, gridPosition: 2, likesCount: 0, commentsCount: 0, createdAgo: 7 },
  { id: "post-a4", name: "Summer lookbook 01", stage: "post", type: "image", caption: "Champagne tones for the summer lookbook.", location: "Lyon, France", altText: "Jewelry flat lay in champagne tones", hashtags: ["lookbook"], status: "draft", approvalStatus: "not_sent", scheduledAt: null, publishedAt: null, isPinned: false, gridPosition: 3, likesCount: 0, commentsCount: 0, createdAgo: 6 },
  { id: "post-a5", name: "Chain bench details", stage: "post", type: "carousel", caption: "Details of the chain-making bench. Every link closed by hand.", location: null, altText: "Close-up photos of chain making", hashtags: ["craft", "chains"], status: "draft", approvalStatus: "changes_requested", scheduledAt: null, publishedAt: null, isPinned: false, gridPosition: 4, likesCount: 0, commentsCount: 0, createdAgo: 5 },
  { id: "post-a6", name: "Aurelle box reveal", stage: "post", type: "image", caption: "The Aurelle box, redesigned. FSC paper, foil-stamped by our neighbors at Presse & Cie.", location: "Lyon, France", altText: "Cream jewelry box with gold foil logo", hashtags: ["packaging"], status: "published", approvalStatus: "approved", scheduledAt: null, publishedAt: daysAgo(12, 12), isPinned: false, gridPosition: 5, likesCount: 1502, commentsCount: 41, createdAgo: 14 },
  { id: "post-a7", name: "Stone setting reel", stage: "post", type: "reel", caption: "Stone setting, real time. Sound on for the workshop ambience.", location: null, altText: null, hashtags: ["stonesetting", "asmr"], status: "published", approvalStatus: "approved", scheduledAt: null, publishedAt: daysAgo(18, 17), isPinned: false, gridPosition: 6, likesCount: 8904, commentsCount: 233, createdAgo: 20 },
  { id: "post-a8", name: "Campaign outtake 03", stage: "post", type: "image", caption: "Héritage campaign, outtake 03.", location: "Lyon, France", altText: "Model wearing gold earrings", hashtags: ["campaign"], status: "draft", approvalStatus: "not_sent", scheduledAt: null, publishedAt: null, isPinned: false, gridPosition: 7, likesCount: 0, commentsCount: 0, createdAgo: 3 },
  // Designer content packages — media + name only; not Instagram posts yet.
  { id: "content-a1", name: "Post 1", stage: "content", type: "carousel", caption: "", location: null, altText: null, hashtags: [], status: "draft", approvalStatus: "not_sent", scheduledAt: null, publishedAt: null, isPinned: false, gridPosition: 8, likesCount: 0, commentsCount: 0, createdAgo: 1 },
  { id: "content-a2", name: "Post 2", stage: "content", type: "image", caption: "", location: null, altText: null, hashtags: [], status: "draft", approvalStatus: "not_sent", scheduledAt: null, publishedAt: null, isPinned: false, gridPosition: 9, likesCount: 0, commentsCount: 0, createdAgo: 1 },
]);

const aurelleMedia = buildMedia([
  { id: "m-a1", postId: "post-a1", mediaType: "image", url: g("#efe3cd", "#d3b58a", "#7c6543", 155), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-a2a", postId: "post-a2", mediaType: "image", url: g("#e7d3be", "#bd9367", "#5f4630", 140), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-a2b", postId: "post-a2", mediaType: "image", url: g("#ecdfc6", "#c9a878", "#6b5334", 120), thumbnailUrl: null, width: 1080, height: 1350, position: 1 },
  { id: "m-a2c", postId: "post-a2", mediaType: "image", url: g("#f1e8d8", "#d4bd94", "#7a643f", 165), thumbnailUrl: null, width: 1080, height: 1350, position: 2 },
  { id: "m-a3", postId: "post-a3", mediaType: "video", url: g("#2e2a24", "#6d5f49", "#c9b28e", 165), thumbnailUrl: g("#2e2a24", "#6d5f49", "#c9b28e", 165), width: 1080, height: 1920, position: 0 },
  { id: "m-a4", postId: "post-a4", mediaType: "image", url: g("#f2ece1", "#d8cbb2", "#96876a", 150), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-a5a", postId: "post-a5", mediaType: "image", url: g("#e2d8c6", "#ab9a77", "#544a35", 135), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-a5b", postId: "post-a5", mediaType: "image", url: g("#d9cfbc", "#9f8f6c", "#4a402d", 155), thumbnailUrl: null, width: 1080, height: 1350, position: 1 },
  { id: "m-a6", postId: "post-a6", mediaType: "image", url: g("#ded9d0", "#a8a094", "#57503f", 160), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-a7", postId: "post-a7", mediaType: "video", url: g("#26221d", "#5c523f", "#b49b72", 150), thumbnailUrl: g("#26221d", "#5c523f", "#b49b72", 150), width: 1080, height: 1920, position: 0 },
  { id: "m-a8", postId: "post-a8", mediaType: "image", url: g("#f0e0d2", "#ceab8e", "#7a5c44", 145), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-c1a", postId: "content-a1", mediaType: "image", url: g("#ece2d0", "#c8ad82", "#6e5a3c", 150), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-c1b", postId: "content-a1", mediaType: "image", url: g("#e5d9c4", "#b79c72", "#5c4a30", 135), thumbnailUrl: null, width: 1080, height: 1350, position: 1 },
  { id: "m-c2", postId: "content-a2", mediaType: "image", url: g("#f0e9db", "#d2c2a2", "#87724f", 160), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
]);

/* ------------------------------------------------------------------ */
/* Studio Norr — interior design studio                                */
/* ------------------------------------------------------------------ */

const norr: Client = {
  id: "client-norr",
  ownerId: DEMO_USER_ID,
  name: "Studio Norr",
  slug: "studio-norr",
  instagramUsername: "studionorr",
  profileName: "STUDIO NORR",
  avatarUrl: g("#e4e6df", "#b9beb2", "#4d5548", 140),
  category: "Interior Design Studio",
  bio: "Interiors with restraint — Stockholm\nResidential · hospitality · objects",
  website: "studionorr.se",
  threadsUsername: null,
  note: null,
  isPrivate: false,
  isVerified: false,
  accountType: "business",
  postsCount: 214,
  followersCount: 58_940,
  followingCount: 402,
  theme: "dark",
  createdAt: daysAgo(60),
  updatedAt: daysAgo(1, 15),
};

const norrHighlights: Highlight[] = [
  { id: "hl-n1", clientId: norr.id, title: "Projects", coverUrl: g("#dcdcd4", "#b9beb2", "#8f9689", 150), position: 0, createdAt: daysAgo(50), updatedAt: daysAgo(50) },
  { id: "hl-n2", clientId: norr.id, title: "Materials", coverUrl: g("#e9e7e0", "#cbcec2", "#6e7568", 135), position: 1, createdAt: daysAgo(45), updatedAt: daysAgo(45) },
  { id: "hl-n3", clientId: norr.id, title: "Studio", coverUrl: g("#d5d6cd", "#a3a99b", "#565c50", 160), position: 2, createdAt: daysAgo(41), updatedAt: daysAgo(41) },
];

const norrPosts = buildPosts(norr.id, [
  { id: "post-n1", name: "Östermalm reveal", stage: "post", type: "carousel", caption: "Östermalm apartment — living room reveal. Travertine, brushed oak, and a Vilhelm Lauritzen floor lamp we fought hard for.", location: "Stockholm, Sweden", altText: "Living room with travertine and oak", hashtags: ["interiordesign", "stockholm"], status: "scheduled", approvalStatus: "approved", scheduledAt: daysAhead(0, 18), publishedAt: null, isPinned: true, gridPosition: 0, likesCount: 4102, commentsCount: 156, createdAgo: 10 },
  { id: "post-n2", name: "Site-to-reveal reel", stage: "post", type: "reel", caption: "Site to reveal in 60 seconds — the Östermalm project.", location: "Stockholm, Sweden", altText: null, hashtags: ["beforeafter", "renovation"], status: "scheduled", approvalStatus: "approved", scheduledAt: daysAhead(2, 17), publishedAt: null, isPinned: false, gridPosition: 1, likesCount: 0, commentsCount: 0, createdAgo: 9 },
  { id: "post-n3", name: "Material study", stage: "post", type: "image", caption: "Material study — travertine & brushed oak.", location: null, altText: "Material samples on gray felt", hashtags: ["materials"], status: "scheduled", approvalStatus: "approved", scheduledAt: daysAhead(8, 11), publishedAt: null, isPinned: false, gridPosition: 2, likesCount: 0, commentsCount: 0, createdAgo: 8 },
  { id: "post-n4", name: "Studio library", stage: "post", type: "image", caption: "The studio library, reorganized by tone.", location: "Stockholm, Sweden", altText: "Bookshelf organized by color", hashtags: ["studio"], status: "published", approvalStatus: "approved", scheduledAt: null, publishedAt: daysAgo(6, 12), isPinned: false, gridPosition: 3, likesCount: 2311, commentsCount: 89, createdAgo: 8 },
  { id: "post-n5", name: "Handrail detail", stage: "post", type: "image", caption: "Hallway detail — bespoke steel handrail, waxed.", location: null, altText: "Steel handrail detail", hashtags: ["details"], status: "draft", approvalStatus: "not_sent", scheduledAt: null, publishedAt: null, isPinned: false, gridPosition: 4, likesCount: 0, commentsCount: 0, createdAgo: 2 },
]);

const norrMedia = buildMedia([
  { id: "m-n1a", postId: "post-n1", mediaType: "image", url: g("#dcdcd4", "#b9beb2", "#8f9689", 150), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-n1b", postId: "post-n1", mediaType: "image", url: g("#e4e2d8", "#c2c0b2", "#7c8274", 130), thumbnailUrl: null, width: 1080, height: 1350, position: 1 },
  { id: "m-n1c", postId: "post-n1", mediaType: "image", url: g("#d0d1c8", "#9ba295", "#4f564a", 165), thumbnailUrl: null, width: 1080, height: 1350, position: 2 },
  { id: "m-n1d", postId: "post-n1", mediaType: "image", url: g("#e9e7e0", "#cbcec2", "#6e7568", 145), thumbnailUrl: null, width: 1080, height: 1350, position: 3 },
  { id: "m-n2", postId: "post-n2", mediaType: "video", url: g("#23261f", "#565c50", "#b0b6a6", 155), thumbnailUrl: g("#23261f", "#565c50", "#b0b6a6", 155), width: 1080, height: 1920, position: 0 },
  { id: "m-n3", postId: "post-n3", mediaType: "image", url: g("#e6e4db", "#bfc0b4", "#5f665a", 150), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-n4", postId: "post-n4", mediaType: "image", url: g("#dfe0d8", "#adb2a4", "#565c50", 140), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-n5", postId: "post-n5", mediaType: "image", url: g("#d7d8d0", "#a2a89a", "#4a5045", 158), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
]);

/* ------------------------------------------------------------------ */
/* Kavo Coffee — specialty roaster                                     */
/* ------------------------------------------------------------------ */

const kavo: Client = {
  id: "client-kavo",
  ownerId: DEMO_USER_ID,
  name: "Kavo Coffee",
  slug: "kavo-coffee",
  instagramUsername: "kavo.coffee",
  profileName: "KAVO",
  avatarUrl: g("#ede0d4", "#b08968", "#7f5539", 140),
  category: "Coffee Shop",
  bio: "Specialty roaster in Rotterdam\nWholesale · subscriptions · brew bar",
  website: "kavo.coffee",
  threadsUsername: "kavo.coffee",
  note: null,
  isPrivate: false,
  isVerified: false,
  accountType: "creator",
  postsCount: 86,
  followersCount: 9_412,
  followingCount: 388,
  theme: "light",
  createdAt: daysAgo(21),
  updatedAt: daysAgo(3, 9),
};

const kavoHighlights: Highlight[] = [
  { id: "hl-k1", clientId: kavo.id, title: "Origins", coverUrl: g("#e3d5c3", "#b08968", "#7f5539", 150), position: 0, createdAt: daysAgo(15), updatedAt: daysAgo(15) },
  { id: "hl-k2", clientId: kavo.id, title: "Brew bar", coverUrl: g("#ede0d4", "#c49a6c", "#5c4126", 135), position: 1, createdAt: daysAgo(12), updatedAt: daysAgo(12) },
];

const kavoPosts = buildPosts(kavo.id, [
  { id: "post-k1", name: "Huila drop carousel", stage: "post", type: "carousel", caption: "Single origin drop — Huila, Colombia. Washed process, notes of red plum and panela. Swipe for the roast curve.", location: "Rotterdam, Netherlands", altText: "Coffee bag and roast chart", hashtags: ["specialtycoffee", "singleorigin"], status: "scheduled", approvalStatus: "awaiting_approval", scheduledAt: daysAhead(4, 9), publishedAt: null, isPinned: false, gridPosition: 0, likesCount: 0, commentsCount: 0, createdAgo: 5 },
  { id: "post-k2", name: "Saturday cupping", stage: "post", type: "image", caption: "Saturday cupping, open to all. 10:00, the roastery.", location: "Rotterdam, Netherlands", altText: "Cupping bowls on wooden table", hashtags: ["cupping"], status: "draft", approvalStatus: "changes_requested", scheduledAt: null, publishedAt: null, isPinned: false, gridPosition: 1, likesCount: 0, commentsCount: 0, createdAgo: 4 },
  { id: "post-k3", name: "Dialing in reel", stage: "post", type: "reel", caption: "Dialing in the new Huila on the EK43.", location: null, altText: null, hashtags: ["barista"], status: "draft", approvalStatus: "not_sent", scheduledAt: null, publishedAt: null, isPinned: false, gridPosition: 2, likesCount: 0, commentsCount: 0, createdAgo: 2 },
]);

const kavoMedia = buildMedia([
  { id: "m-k1a", postId: "post-k1", mediaType: "image", url: g("#e3d5c3", "#b08968", "#7f5539", 150), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-k1b", postId: "post-k1", mediaType: "image", url: g("#ede0d4", "#c49a6c", "#5c4126", 120), thumbnailUrl: null, width: 1080, height: 1350, position: 1 },
  { id: "m-k2", postId: "post-k2", mediaType: "image", url: g("#e8dbc9", "#bb9268", "#6b4f31", 145), thumbnailUrl: null, width: 1080, height: 1350, position: 0 },
  { id: "m-k3", postId: "post-k3", mediaType: "video", url: g("#2a231c", "#63503c", "#c9a97e", 155), thumbnailUrl: g("#2a231c", "#63503c", "#c9a97e", 155), width: 1080, height: 1920, position: 0 },
]);

/* ------------------------------------------------------------------ */

const comments: Comment[] = [
  { id: "c-1", postId: "post-a5", authorName: "Camille Aurelle", authorEmail: "camille@maisonaurelle.com", body: "Crop feels too tight on slide two — can we see a little more of the bench?", commentType: "change_request", resolved: false, createdAt: daysAgo(2, 16) },
  { id: "c-2", postId: "post-a1", authorName: "Camille Aurelle", authorEmail: "camille@maisonaurelle.com", body: "Beautiful. Can the caption mention the engraving service?", commentType: "general", resolved: false, createdAt: daysAgo(1, 11) },
  { id: "c-3", postId: "post-n1", authorName: "Elin Åkesson", authorEmail: "elin@studionorr.se", body: "Approved — this is exactly the tone we want for the reveal.", commentType: "general", resolved: true, createdAt: daysAgo(3, 14) },
  { id: "c-4", postId: "post-k2", authorName: "Jasper Vink", authorEmail: "jasper@kavo.coffee", body: "Wrong date — cupping moved to Sunday. Please update before it goes out.", commentType: "change_request", resolved: false, createdAt: daysAgo(1, 9) },
];

const approvals: Approval[] = [
  { id: "ap-1", clientId: norr.id, postId: "post-n1", reviewerName: "Elin Åkesson", reviewerEmail: "elin@studionorr.se", status: "approved", message: "Exactly the tone we want.", createdAt: daysAgo(3, 14), updatedAt: daysAgo(3, 14) },
  { id: "ap-2", clientId: norr.id, postId: "post-n2", reviewerName: "Elin Åkesson", reviewerEmail: "elin@studionorr.se", status: "approved", message: null, createdAt: daysAgo(3, 14), updatedAt: daysAgo(3, 14) },
  { id: "ap-3", clientId: aurelle.id, postId: "post-a5", reviewerName: "Camille Aurelle", reviewerEmail: "camille@maisonaurelle.com", status: "changes_requested", message: "Crop feels too tight on slide two.", createdAt: daysAgo(2, 16), updatedAt: daysAgo(2, 16) },
  { id: "ap-4", clientId: kavo.id, postId: "post-k2", reviewerName: "Jasper Vink", reviewerEmail: "jasper@kavo.coffee", status: "changes_requested", message: "Cupping moved to Sunday.", createdAt: daysAgo(1, 9), updatedAt: daysAgo(1, 9) },
];

const shareLinks: ShareLink[] = [
  { id: "sl-1", clientId: aurelle.id, token: "demo-aurelle-h3ritage", isActive: true, expiresAt: daysAhead(12), allowComments: true, allowApproval: true, createdAt: daysAgo(4) },
  { id: "sl-2", clientId: norr.id, token: "demo-norr-ostermalm", isActive: true, expiresAt: null, allowComments: true, allowApproval: true, createdAt: daysAgo(6) },
  { id: "sl-3", clientId: kavo.id, token: "demo-kavo-hu1la", isActive: false, expiresAt: null, allowComments: true, allowApproval: false, createdAt: daysAgo(9) },
];

const activity: Activity[] = [
  { id: "act-1", clientId: norr.id, type: "approval_received", description: "Elin Åkesson approved 2 posts for Studio Norr", createdAt: daysAgo(3, 14) },
  { id: "act-2", clientId: aurelle.id, type: "post_created", description: "You added 6 images to Maison Aurelle", createdAt: daysAgo(3, 10) },
  { id: "act-3", clientId: kavo.id, type: "share_link_created", description: "Preview link sent to Kavo Coffee", createdAt: daysAgo(9, 12) },
  { id: "act-4", clientId: aurelle.id, type: "changes_requested", description: "Camille Aurelle requested changes on 1 post", createdAt: daysAgo(2, 16) },
  { id: "act-5", clientId: norr.id, type: "post_scheduled", description: "5 posts scheduled for Studio Norr", createdAt: daysAgo(4, 9) },
  { id: "act-6", clientId: kavo.id, type: "changes_requested", description: "Jasper Vink requested changes on 1 post", createdAt: daysAgo(1, 9) },
];

export function createSeedSnapshot(): WorkspaceSnapshot {
  return {
    user: {
      id: DEMO_USER_ID,
      email: "demo@gridline.studio",
      displayName: "Aleandro Rossi",
      avatarUrl: null,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(90),
    },
    clients: [aurelle, norr, kavo],
    highlights: [...aurelleHighlights, ...norrHighlights, ...kavoHighlights],
    posts: [...aurellePosts, ...norrPosts, ...kavoPosts],
    media: [...aurelleMedia, ...norrMedia, ...kavoMedia],
    comments,
    approvals,
    shareLinks,
    activity,
  };
}

export function createEmptySnapshot(): WorkspaceSnapshot {
  const now = new Date().toISOString();
  return {
    user: {
      id: DEMO_USER_ID,
      email: "demo@gridline.studio",
      displayName: "Demo user",
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    clients: [],
    highlights: [],
    posts: [],
    media: [],
    comments: [],
    approvals: [],
    shareLinks: [],
    activity: [],
  };
}
