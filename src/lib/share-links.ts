import type { Client, ShareLink } from "@/types/domain";

/** What a share link does right now. A disabled link reads as disabled even if it also expired. */
export type ShareLinkStatus = "active" | "disabled" | "expired";

export function shareLinkStatus(link: ShareLink, now: Date = new Date()): ShareLinkStatus {
  if (!link.isActive) return "disabled";
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

export interface Period {
  /** "week", "month", or "YYYY-MM" for older months. */
  key: string;
  label: string;
}

/** Monday 00:00 (local time) of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** When a link was created: This week, This month, or its month ("September 2026"). */
export function periodOf(createdAt: string, now: Date = new Date()): Period {
  const created = new Date(createdAt);
  if (created >= startOfWeek(now)) return { key: "week", label: "This week" };
  if (created >= new Date(now.getFullYear(), now.getMonth(), 1)) {
    return { key: "month", label: "This month" };
  }
  return {
    key: `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`,
    label: created.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

export interface PeriodGroup extends Period {
  /** Newest first. */
  links: ShareLink[];
}

export interface ClientLinkGroup {
  client: Client;
  /** Links shown directly. */
  current: PeriodGroup[];
  /** Disabled and expired links, shown collapsed (only when not filtering by status). */
  archive: PeriodGroup[];
}

export interface ShareLinkFilters {
  clientId: string | "all";
  status: ShareLinkStatus | "all";
}

function byPeriod(links: ShareLink[], now: Date): PeriodGroup[] {
  const groups = new Map<string, PeriodGroup>();
  const sorted = [...links].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const link of sorted) {
    const period = periodOf(link.createdAt, now);
    const group = groups.get(period.key) ?? { ...period, links: [] };
    group.links.push(link);
    groups.set(period.key, group);
  }
  // Links are newest first, so the groups already come out newest first.
  return [...groups.values()];
}

/**
 * The Shared previews page layout: clients A–Z, each with its links grouped
 * by period. Without a status filter, disabled and expired links go to the
 * client's archive; with one, the matching links are shown directly. Links
 * of clients that no longer exist and clients without matches are left out.
 */
export function groupShareLinks(
  links: ShareLink[],
  clients: Client[],
  filters: ShareLinkFilters,
  now: Date = new Date(),
): ClientLinkGroup[] {
  return clients
    .filter((client) => filters.clientId === "all" || client.id === filters.clientId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((client) => {
      const own = links.filter((link) => link.clientId === client.id);
      const matches =
        filters.status === "all" ? own : own.filter((l) => shareLinkStatus(l, now) === filters.status);
      if (matches.length === 0) return [];
      const archived = (l: ShareLink) => filters.status === "all" && shareLinkStatus(l, now) !== "active";
      return [
        {
          client,
          current: byPeriod(matches.filter((l) => !archived(l)), now),
          archive: byPeriod(matches.filter(archived), now),
        },
      ];
    });
}
