import type { Repository } from "@/lib/repositories/types";
import type { Client, Highlight, PostMedia } from "@/types/domain";

export interface MediaHolders {
  clients: Client[];
  highlights: Highlight[];
  media: PostMedia[];
}

/**
 * Replace demo-mode `local:` references with displayable data URLs, in place,
 * so UI components never resolve media themselves. Used for the workspace
 * snapshot and for every share-page load. A reference whose stored file is
 * missing keeps its `local:` value — it renders as placeholder art instead of
 * failing the whole load.
 */
export async function resolveMediaRefs(
  repo: Repository,
  { clients, highlights, media }: MediaHolders,
): Promise<void> {
  const resolve = async (url: string | null): Promise<string | null> => {
    if (!url || !url.startsWith("local:")) return url;
    try {
      return await repo.resolveMediaUrl(url);
    } catch {
      return url;
    }
  };

  await Promise.all([
    ...clients.map(async (client) => {
      client.avatarUrl = await resolve(client.avatarUrl);
    }),
    ...highlights.map(async (highlight) => {
      highlight.coverUrl = await resolve(highlight.coverUrl);
    }),
    ...media.map(async (item) => {
      item.url = (await resolve(item.url)) ?? item.url;
      item.thumbnailUrl = await resolve(item.thumbnailUrl);
    }),
  ]);
}
