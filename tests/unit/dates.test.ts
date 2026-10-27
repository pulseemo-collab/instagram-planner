import { describe, expect, it } from "vitest";
import {
  dayKeyFor,
  dayKeyToDate,
  dayKeyToNumeric,
  isoFromLocalParts,
  localDayKey,
  localPartsFromIso,
  monthGrid,
  moveIsoToDay,
  numericToDayKey,
  scheduledDayKey,
} from "@/lib/dates";

// vitest.config.ts runs these in Europe/Rome (UTC+1, UTC+2 in summer).

describe("numericToDayKey (DD/MM/YYYY input)", () => {
  it("parses valid dates, with or without leading zeros", () => {
    expect(numericToDayKey("21/07/2026")).toBe("2026-07-21");
    expect(numericToDayKey("1/8/2026")).toBe("2026-08-01");
    expect(numericToDayKey("  05/09/2026 ")).toBe("2026-09-05");
  });

  it("rejects impossible or wrongly formatted dates", () => {
    expect(numericToDayKey("31/02/2026")).toBeNull();
    expect(numericToDayKey("00/01/2026")).toBeNull();
    expect(numericToDayKey("12/13/2026")).toBeNull();
    expect(numericToDayKey("2026-08-01")).toBeNull();
    expect(numericToDayKey("")).toBeNull();
  });

  it("round-trips with dayKeyToNumeric", () => {
    expect(dayKeyToNumeric("2026-08-01")).toBe("01/08/2026");
    expect(numericToDayKey(dayKeyToNumeric("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("local date/time parts", () => {
  it("a local time just after midnight stays on its day (no UTC shift)", () => {
    const iso = isoFromLocalParts("2026-08-01", "00:15");
    expect(iso).toBe("2026-07-31T22:15:00.000Z"); // Rome is UTC+2 in August
    expect(localDayKey(iso)).toBe("2026-08-01");
    expect(localPartsFromIso(iso)).toEqual({ day: "2026-08-01", time: "00:15" });
  });

  it("moving a post to another day keeps its local time across a DST change", () => {
    const before = isoFromLocalParts("2026-10-24", "18:00"); // UTC+2
    const moved = moveIsoToDay(before, "2026-10-26"); // UTC+1 after DST ends
    expect(moved).toBe("2026-10-26T17:00:00.000Z");
    expect(localPartsFromIso(moved)).toEqual({ day: "2026-10-26", time: "18:00" });
  });

  it("dayKeyFor / dayKeyToDate use local midnight", () => {
    const date = dayKeyToDate("2026-03-29"); // the night DST starts
    expect(date.getHours()).toBe(0);
    expect(dayKeyFor(date)).toBe("2026-03-29");
  });
});

describe("scheduledDayKey", () => {
  it("uses the timezone-free day for content packages", () => {
    expect(scheduledDayKey({ stage: "content", scheduledDay: "2026-08-01", scheduledAt: null })).toBe(
      "2026-08-01",
    );
    expect(scheduledDayKey({ stage: "content", scheduledDay: null, scheduledAt: null })).toBeNull();
  });

  it("uses the local day of the publishing moment for posts", () => {
    expect(
      scheduledDayKey({ stage: "post", scheduledDay: null, scheduledAt: "2026-07-31T22:15:00.000Z" }),
    ).toBe("2026-08-01");
    expect(scheduledDayKey({ stage: "post", scheduledDay: null, scheduledAt: null })).toBeNull();
  });
});

describe("monthGrid", () => {
  it("returns Monday-first weeks covering the whole month", () => {
    const weeks = monthGrid(2026, 7); // August 2026 starts on a Saturday
    expect(weeks.every((w) => w.days.length === 7)).toBe(true);
    expect(weeks.every((w) => w.days[0].getDay() === 1)).toBe(true);
    const keys = weeks.flatMap((w) => w.days.map(dayKeyFor));
    expect(keys).toContain("2026-08-01");
    expect(keys).toContain("2026-08-31");
  });
});
