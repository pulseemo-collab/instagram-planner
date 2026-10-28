import { describe, expect, it } from "vitest";
import { groupShareLinks, periodOf, shareLinkStatus } from "@/lib/share-links";
import type { ShareLink } from "@/types/domain";
import { makeClient } from "./fixtures";

// Wednesday 28 October 2026, 12:00 local time.
const NOW = new Date(2026, 9, 28, 12, 0, 0);
const at = (y: number, m: number, d: number) => new Date(y, m, d, 10, 0, 0).toISOString();

const link = (id: string, overrides: Partial<ShareLink> = {}): ShareLink => ({
  id,
  clientId: "c1",
  token: `token-${id}`,
  isActive: true,
  expiresAt: null,
  allowComments: true,
  allowApproval: true,
  createdAt: at(2026, 9, 27),
  ...overrides,
});

describe("share link status", () => {
  it("disabled wins over expired; a past expiry is expired", () => {
    expect(shareLinkStatus(link("a"), NOW)).toBe("active");
    expect(shareLinkStatus(link("b", { expiresAt: at(2026, 9, 27) }), NOW)).toBe("expired");
    expect(shareLinkStatus(link("c", { expiresAt: at(2026, 10, 2) }), NOW)).toBe("active");
    expect(shareLinkStatus(link("d", { isActive: false, expiresAt: at(2026, 9, 1) }), NOW)).toBe("disabled");
  });
});

describe("periods", () => {
  it("this week (from Monday), this month, then one group per month", () => {
    expect(periodOf(at(2026, 9, 26), NOW)).toEqual({ key: "week", label: "This week" }); // Monday
    expect(periodOf(at(2026, 9, 25), NOW)).toEqual({ key: "month", label: "This month" }); // Sunday
    expect(periodOf(at(2026, 9, 1), NOW)).toEqual({ key: "month", label: "This month" });
    expect(periodOf(at(2026, 8, 30), NOW)).toEqual({ key: "2026-09", label: "September 2026" });
    expect(periodOf(at(2025, 11, 3), NOW)).toEqual({ key: "2025-12", label: "December 2025" });
  });

  it("a week that started last month still counts as this week", () => {
    const monday = new Date(2026, 10, 3, 9, 0, 0); // Tue 3 Nov; the week began Mon 2 Nov
    expect(periodOf(at(2026, 10, 2), monday).key).toBe("week");
    const thursday = new Date(2026, 9, 1, 9, 0, 0); // Thu 1 Oct; week began Mon 28 Sep
    expect(periodOf(at(2026, 8, 28), thursday).key).toBe("week");
  });
});

describe("groupShareLinks", () => {
  const clients = [makeClient({ id: "c1", name: "Kavo" }), makeClient({ id: "c2", name: "Aurelle" })];
  const links = [
    link("new", { createdAt: at(2026, 9, 27) }),
    link("old", { createdAt: at(2026, 7, 10) }),
    link("off", { isActive: false, createdAt: at(2026, 9, 26) }),
    link("gone", { expiresAt: at(2026, 9, 2), createdAt: at(2026, 8, 1) }),
    link("other", { clientId: "c2", createdAt: at(2026, 9, 5) }),
    link("orphan", { clientId: "deleted-client" }),
  ];

  it("groups by client (by name), then period; disabled/expired go to the archive", () => {
    const groups = groupShareLinks(links, clients, { clientId: "all", status: "all" }, NOW);
    expect(groups.map((g) => g.client.name)).toEqual(["Aurelle", "Kavo"]);
    const kavo = groups[1];
    expect(kavo.current.map((p) => [p.label, p.links.map((l) => l.id)])).toEqual([
      ["This week", ["new"]],
      ["August 2026", ["old"]],
    ]);
    expect(kavo.archive.flatMap((p) => p.links.map((l) => l.id))).toEqual(["off", "gone"]);
    expect(groups[0].archive).toEqual([]);
  });

  it("filters by client and status; a status filter shows matches directly", () => {
    const onlyKavo = groupShareLinks(links, clients, { clientId: "c1", status: "all" }, NOW);
    expect(onlyKavo.map((g) => g.client.id)).toEqual(["c1"]);

    const expired = groupShareLinks(links, clients, { clientId: "all", status: "expired" }, NOW);
    expect(expired.map((g) => g.client.id)).toEqual(["c1"]);
    expect(expired[0].current.flatMap((p) => p.links.map((l) => l.id))).toEqual(["gone"]);
    expect(expired[0].archive).toEqual([]);

    const active = groupShareLinks(links, clients, { clientId: "all", status: "active" }, NOW);
    expect(active.flatMap((g) => [...g.current, ...g.archive]).flatMap((p) => p.links.map((l) => l.id)))
      .toEqual(["other", "new", "old"]);
  });

  it("returns nothing for a client without matching links", () => {
    expect(groupShareLinks(links, clients, { clientId: "c2", status: "disabled" }, NOW)).toEqual([]);
  });
});
