import type { WorkspaceSnapshot } from "@/lib/repositories/types";
import { POST_TYPE_LABELS } from "@/types/domain";

export interface SearchResult {
  id: string;
  kind: "client" | "post";
  href: string;
  title: string;
  subtitle: string;
}

export interface SearchResults {
  clients: SearchResult[];
  posts: SearchResult[];
}

/** Lower-case, accents stripped: "Héritage" matches "heritage". */
function normalize(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/**
 * Score a candidate: 0 = no match (every query word must appear), higher is
 * better (a field that starts with the query ranks first).
 */
function score(fields: string[], words: string[], query: string): number {
  const haystack = normalize(fields.join(" "));
  if (!words.every((word) => haystack.includes(word))) return 0;
  return fields.some((field) => normalize(field).startsWith(query)) ? 2 : 1;
}

/**
 * Client-side search over the loaded workspace: clients by name / username /
 * profile name, posts (and calendar content packages) by name / caption.
 */
export function searchWorkspace(
  snapshot: WorkspaceSnapshot,
  rawQuery: string,
  limit = 6,
): SearchResults {
  const query = normalize(rawQuery.trim());
  const words = query.split(/\s+/).filter(Boolean);
  if (!words.length) return { clients: [], posts: [] };

  const byRank = <T extends { rank: number; updatedAt: string }>(a: T, b: T) =>
    b.rank - a.rank || b.updatedAt.localeCompare(a.updatedAt);

  const clients = snapshot.clients
    .map((client) => ({
      rank: score([client.name, client.instagramUsername, client.profileName], words, query),
      updatedAt: client.updatedAt,
      result: {
        id: client.id,
        kind: "client" as const,
        href: `/clients/${client.id}`,
        title: client.name,
        subtitle: `@${client.instagramUsername}`,
      },
    }))
    .filter((item) => item.rank > 0)
    .sort(byRank)
    .slice(0, limit)
    .map((item) => item.result);

  const clientNames = new Map(snapshot.clients.map((c) => [c.id, c.name]));
  const posts = snapshot.posts
    .map((post) => ({
      rank: score([post.name, post.caption], words, query),
      updatedAt: post.updatedAt,
      result: {
        id: post.id,
        kind: "post" as const,
        href: `/clients/${post.clientId}/posts/${post.id}`,
        title: post.name || post.caption.slice(0, 60) || "Untitled",
        subtitle: `${clientNames.get(post.clientId) ?? ""} · ${
          post.stage === "content" ? "Content" : POST_TYPE_LABELS[post.type]
        }`,
      },
    }))
    .filter((item) => item.rank > 0)
    .sort(byRank)
    .slice(0, limit)
    .map((item) => item.result);

  return { clients, posts };
}
