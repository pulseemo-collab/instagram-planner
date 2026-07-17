import type { IgMedia, IgPlaceholderArt, IgProfile } from "./types";

function art(from: string, via: string, to: string, angle?: number): IgPlaceholderArt {
  return { from, via, to, angle };
}

function media(
  id: string,
  kind: IgMedia["kind"],
  placeholder: IgPlaceholderArt,
  extra?: Partial<Pick<IgMedia, "isPinned" | "viewCount">>,
): IgMedia {
  return { id, kind, placeholder, ...extra };
}

/**
 * Maison Aurelle — the jewelry client from the dashboard mock data, fleshed
 * out into a full profile. Warm champagne/gold tones keep the placeholder
 * grid coherent until real uploads exist.
 */
export const mockProfile: IgProfile = {
  username: "maisonaurelle",
  fullName: "Maison Aurelle",
  isVerified: true,
  isPrivate: false,
  category: "Jewelry/Watches",
  bioLines: [
    "Fine jewelry, made slowly in Lyon",
    "Recycled gold · lab-grown stones",
    "Héritage collection — out now ↓",
  ],
  website: "maisonaurelle.com/heritage",
  postCount: 128,
  followerCount: 24_312,
  followingCount: 812,
  hasActiveStory: true,
  avatar: {
    placeholder: art("#f3e7d3", "#d9be93", "#8a7354", 140),
  },
  highlights: [
    { id: "hl-1", label: "Héritage", cover: art("#e9d9bd", "#c2a377", "#6d5a3a", 155) },
    { id: "hl-2", label: "Atelier", cover: art("#ece5d8", "#b7a98c", "#4f4632", 130) },
    { id: "hl-3", label: "Press", cover: art("#f4f0e8", "#d4cbb8", "#8d8672", 160) },
    { id: "hl-4", label: "On you", cover: art("#e6d2c3", "#c09a7c", "#6e4f3a", 145) },
    { id: "hl-5", label: "Stones", cover: art("#dfe3de", "#a9b3a6", "#5d675c", 150) },
  ],
  posts: [
    media("p-01", "image", art("#efe3cd", "#d3b58a", "#7c6543", 155), { isPinned: true }),
    media("p-02", "carousel", art("#e7d3be", "#bd9367", "#5f4630", 140), { isPinned: true }),
    media("p-03", "reel", art("#2e2a24", "#6d5f49", "#c9b28e", 165)),
    media("p-04", "image", art("#f2ece1", "#d8cbb2", "#96876a", 150)),
    media("p-05", "carousel", art("#e2d8c6", "#ab9a77", "#544a35", 135)),
    media("p-06", "image", art("#ded9d0", "#a8a094", "#57503f", 160)),
    media("p-07", "image", art("#f0e0d2", "#ceab8e", "#7a5c44", 145)),
    media("p-08", "reel", art("#26221d", "#5c523f", "#b49b72", 150)),
    media("p-09", "carousel", art("#ece1cc", "#c7ab7f", "#6b5638", 158)),
    media("p-10", "image", art("#e5e0d6", "#b3ab99", "#635c48", 142)),
    media("p-11", "image", art("#efe6d8", "#d0b995", "#836b49", 152)),
    media("p-12", "carousel", art("#e0d2bf", "#b08c66", "#513e2c", 148)),
    media("p-13", "image", art("#f1eade", "#d6c8ac", "#8f8163", 156)),
    media("p-14", "reel", art("#2b2620", "#665a44", "#c2a377", 144)),
    media("p-15", "image", art("#e9dfcf", "#bfa87f", "#5e4d33", 150)),
  ],
  reels: [
    media("r-01", "reel", art("#2e2a24", "#6d5f49", "#c9b28e", 165), { viewCount: 48_200 }),
    media("r-02", "reel", art("#26221d", "#5c523f", "#b49b72", 150), { viewCount: 24_100 }),
    media("r-03", "reel", art("#2b2620", "#665a44", "#c2a377", 144), { viewCount: 132_400 }),
    media("r-04", "reel", art("#211f1c", "#4f4a3d", "#a89a78", 158), { viewCount: 9_874 }),
    media("r-05", "reel", art("#302a22", "#71614a", "#d3b98f", 148), { viewCount: 17_300 }),
    media("r-06", "reel", art("#28251f", "#615743", "#bda67e", 152), { viewCount: 61_800 }),
  ],
  reposts: [
    media("rp-01", "image", art("#e3dccf", "#b0a68e", "#5d5442", 150)),
    media("rp-02", "carousel", art("#ece4d4", "#c6b48d", "#6f5f42", 146)),
    media("rp-03", "image", art("#e8ddd1", "#bfa88a", "#6a563f", 154)),
  ],
  tagged: [
    media("t-01", "image", art("#e7dccb", "#bda684", "#635137", 150)),
    media("t-02", "carousel", art("#ede7db", "#cbbfa5", "#7d7259", 145)),
    media("t-03", "image", art("#e2d4c2", "#b3906c", "#553f2c", 155)),
    media("t-04", "image", art("#eee9e0", "#d2c9b6", "#8b8168", 148)),
    media("t-05", "reel", art("#2d2822", "#685c46", "#c5ac82", 152)),
    media("t-06", "image", art("#e6dbc9", "#baa17b", "#5c4a32", 150)),
  ],
};
