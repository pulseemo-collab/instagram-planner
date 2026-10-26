/**
 * Date helpers that deliberately work in the user's local timezone. Values
 * round-trip through `Date` locally — never via UTC string math — to avoid
 * day-shift bugs.
 */

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatDate(iso);
}

/** Numeric date in DD/MM/YYYY, e.g. "21/07/2026". */
export function formatNumericDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** "dd/mm/yyyy" → internal "yyyy-mm-dd" day key; null when invalid. */
export function numericToDayKey(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const date = new Date(Number(yyyy), month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
  return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Internal "yyyy-mm-dd" day key → display "dd/mm/yyyy". */
export function dayKeyToNumeric(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  return `${d}/${m}/${y}`;
}

/** "yyyy-mm-dd" for the LOCAL calendar day of an ISO timestamp. */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * The calendar day an item sits on: a content package's timezone-free day,
 * or the local day of a completed post's publishing moment. Null when the
 * item isn't on the calendar.
 */
export function scheduledDayKey(item: {
  stage: "content" | "post";
  scheduledAt: string | null;
  scheduledDay: string | null;
}): string | null {
  if (item.stage === "content") return item.scheduledDay;
  return item.scheduledAt ? localDayKey(item.scheduledAt) : null;
}

/** Local midnight of a "yyyy-mm-dd" day key (for display formatting). */
export function dayKeyToDate(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayKeyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** Combine a local "yyyy-mm-dd" + "HH:MM" into an ISO timestamp. */
export function isoFromLocalParts(day: string, time: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).toISOString();
}

/** Local "yyyy-mm-dd" and "HH:MM" parts of an ISO timestamp (for form inputs). */
export function localPartsFromIso(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: dayKeyFor(d),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

/** Move only the calendar day of an ISO timestamp, preserving local time of day. */
export function moveIsoToDay(iso: string, dayKey: string): string {
  const source = new Date(iso);
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d, source.getHours(), source.getMinutes()).toISOString();
}

export interface CalendarWeek {
  days: Date[];
}

/** Weeks (Mon-first) covering the given month, in local time. */
export function monthGrid(year: number, monthIndex: number): CalendarWeek[] {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  const weekday = (first.getDay() + 6) % 7; // Monday = 0
  start.setDate(first.getDate() - weekday);

  const weeks: CalendarWeek[] = [];
  const cursor = new Date(start);
  do {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push({ days });
  } while (cursor.getMonth() === monthIndex && weeks.length < 6);
  return weeks;
}

export function isSameMonth(date: Date, year: number, monthIndex: number): boolean {
  return date.getFullYear() === year && date.getMonth() === monthIndex;
}

export function isToday(date: Date): boolean {
  return dayKeyFor(date) === dayKeyFor(new Date());
}
