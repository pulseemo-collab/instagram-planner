"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Layers,
  Plus,
  Undo2,
  UserRound,
} from "lucide-react";
import { AddContentDialog } from "@/components/calendar/add-content-dialog";
import { MediaArt } from "@/components/instagram/media-art";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/field";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  dayKeyFor,
  dayKeyToNumeric,
  formatNumericDate,
  formatTime,
  isSameMonth,
  isToday,
  localDayKey,
  localPartsFromIso,
  monthGrid,
  moveIsoToDay,
  numericToDayKey,
} from "@/lib/dates";
import { coverMediaFor, parseMediaRef } from "@/lib/instagram/map-profile";
import { useMutate, useWorkspace } from "@/lib/store/hooks";
import type { Client, Post, PostMedia, PostType } from "@/types/domain";

const typeIcons: Record<PostType, typeof ImageIcon> = {
  image: ImageIcon,
  carousel: Layers,
  reel: Film,
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SELECTED_CLIENT_KEY = "gridline-calendar-client";
const MONTH_KEY = "gridline-calendar-month";

function readStoredMonth(): { year: number; month: number } {
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() };
  if (typeof window === "undefined") return fallback;
  const raw = sessionStorage.getItem(MONTH_KEY);
  const match = raw?.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return fallback;
  return { year: Number(match[1]), month: Number(match[2]) };
}

/* ------------------------------------------------------------------------- */
/* Calendar chip (module scope — stable identity keeps drags alive)          */
/* ------------------------------------------------------------------------- */

interface PostChipProps {
  post: Post;
  media: PostMedia[];
  draggingId: string | null;
  onOpen: (post: Post) => void;
  onDragStartChip: (id: string) => void;
  onDragEndChip: () => void;
}

function PostChip({ post, media, draggingId, onOpen, onDragStartChip, onDragEndChip }: PostChipProps) {
  const cover = coverMediaFor(post, media);
  const ref = parseMediaRef(cover?.thumbnailUrl ?? cover?.url ?? null);
  const TypeIcon = typeIcons[post.type];
  const isContent = post.stage === "content";
  return (
    <button
      type="button"
      draggable
      onClick={() => onOpen(post)}
      onDragStart={(e) => {
        onDragStartChip(post.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", post.id);
      }}
      onDragEnd={onDragEndChip}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-md border border-line bg-panel px-1.5 py-1 text-left shadow-panel transition-opacity hover:border-line-strong",
        draggingId === post.id && "opacity-40",
      )}
      title={
        isContent
          ? `${post.name || "Content"} — post not created yet`
          : `${post.name || post.caption || "post"}`
      }
    >
      <span className="relative block size-5 shrink-0 overflow-hidden rounded-sm">
        <MediaArt art={ref.art} imageUrl={ref.imageUrl} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium leading-tight text-ink">
        {post.name || post.caption || "Untitled"}
      </span>
      {isContent ? (
        // Amber dot: content dropped on a day but the post isn't created yet.
        <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
      ) : (
        <>
          <TypeIcon className="size-3 shrink-0 text-ink-faint" aria-hidden="true" />
          {post.scheduledAt && (
            <span className="hidden shrink-0 font-mono text-[9.5px] text-ink-faint xl:inline">
              {formatTime(post.scheduledAt)}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------------- */
/* Content package card (module scope)                                       */
/* ------------------------------------------------------------------------- */

interface ContentCardProps {
  post: Post;
  media: PostMedia[];
  draggingId: string | null;
  onOpen: (post: Post) => void;
  onSchedule: (post: Post) => void;
  onUnschedule: (post: Post) => void;
  onDragStartChip: (id: string) => void;
  onDragEndChip: () => void;
}

function ContentCard({
  post,
  media,
  draggingId,
  onOpen,
  onSchedule,
  onUnschedule,
  onDragStartChip,
  onDragEndChip,
}: ContentCardProps) {
  const own = media.filter((m) => m.postId === post.id);
  const cover = coverMediaFor(post, media);
  const ref = parseMediaRef(cover?.thumbnailUrl ?? cover?.url ?? null);
  const scheduled = Boolean(post.scheduledAt);

  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStartChip(post.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", post.id);
      }}
      onDragEnd={onDragEndChip}
      className={cn(
        "flex w-56 shrink-0 cursor-grab flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-panel transition-opacity active:cursor-grabbing",
        draggingId === post.id && "opacity-40",
      )}
      role="group"
      aria-label={`Content package ${post.name || "untitled"}`}
    >
      <button
        type="button"
        onClick={() => onOpen(post)}
        className="relative block aspect-[16/10] w-full overflow-hidden"
        aria-label={`Open ${post.name || "content"}`}
      >
        <MediaArt art={ref.art} imageUrl={ref.imageUrl} />
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {own.length} {own.length === 1 ? "file" : "files"}
        </span>
      </button>
      <div className="space-y-1.5 p-2.5">
        <p className="truncate text-[12.5px] font-semibold text-ink">{post.name || "Untitled"}</p>
        <p className="text-[11px] text-ink-faint">
          {scheduled ? (
            <span className="text-sky-800">Scheduled · {formatNumericDate(post.scheduledAt!)}</span>
          ) : (
            "Unscheduled"
          )}
        </p>
        <div className="flex gap-1 pt-0.5">
          <button
            type="button"
            onClick={() => onSchedule(post)}
            className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-1 text-[10.5px] font-medium text-ink-soft hover:border-line-strong hover:text-ink"
          >
            <CalendarPlus className="size-3" aria-hidden="true" />
            {scheduled ? "Reschedule" : "Schedule"}
          </button>
          {scheduled && (
            <button
              type="button"
              onClick={() => onUnschedule(post)}
              className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-1 text-[10.5px] font-medium text-ink-soft hover:border-line-strong hover:text-ink"
            >
              <Undo2 className="size-3" aria-hidden="true" />
              Unschedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Page                                                                      */
/* ------------------------------------------------------------------------- */

type ContentFilter = "all" | "unscheduled" | "scheduled";

export default function CalendarPage() {
  const { status, snapshot } = useWorkspace();
  const router = useRouter();
  const mutate = useMutate();
  const { toast } = useToast();

  const today = new Date();
  const [{ year, month }, setYearMonth] = useState(readStoredMonth);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(SELECTED_CLIENT_KEY),
  );
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [overUnschedule, setOverUnschedule] = useState(false);
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [schedulingPost, setSchedulingPost] = useState<Post | null>(null);

  const weeks = useMemo(() => monthGrid(year, month), [year, month]);

  function setMonthState(nextYear: number, nextMonth: number) {
    sessionStorage.setItem(MONTH_KEY, `${nextYear}-${nextMonth}`);
    setYearMonth({ year: nextYear, month: nextMonth });
  }

  // Validate persisted selection against existing clients.
  const client: Client | null = useMemo(() => {
    if (!snapshot || !selectedClientId) return null;
    return snapshot.clients.find((c) => c.id === selectedClientId) ?? null;
  }, [snapshot, selectedClientId]);

  const clientItems = useMemo(
    () => (snapshot && client ? snapshot.posts.filter((p) => p.clientId === client.id) : []),
    [snapshot, client],
  );
  const contentItems = useMemo(
    () => clientItems.filter((p) => p.stage === "content"),
    [clientItems],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const item of clientItems) {
      if (!item.scheduledAt) continue;
      const key = localDayKey(item.scheduledAt);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    }
    return map;
  }, [clientItems]);

  const filteredContent = useMemo(() => {
    const list = contentItems.filter((item) => {
      if (contentFilter === "unscheduled") return !item.scheduledAt;
      if (contentFilter === "scheduled") return Boolean(item.scheduledAt);
      return true;
    });
    return [...list].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [contentItems, contentFilter]);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  function selectClient(id: string) {
    localStorage.setItem(SELECTED_CLIENT_KEY, id);
    setSelectedClientId(id);
  }

  /* ---------------- client-selection state ---------------- */

  if (!client) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Choose a client</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            The calendar plans one client at a time. Pick whose content you&apos;re working on —
            you can switch at any moment from the top of the page.
          </p>
        </div>
        {snapshot.clients.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No clients yet"
            description="Create your first client to start planning their calendar."
            action={
              <Button variant="primary" onClick={() => router.push("/clients?new=1")}>
                <Plus className="size-4" aria-hidden="true" />
                New client
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {snapshot.clients.map((c) => {
              const avatarRef = parseMediaRef(c.avatarUrl);
              const count = snapshot.posts.filter((p) => p.clientId === c.id).length;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectClient(c.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-4 text-left shadow-panel transition-shadow hover:shadow-panel-hover"
                  >
                    <span className="relative block size-11 shrink-0 overflow-hidden rounded-full border border-line">
                      <MediaArt art={avatarRef.art} imageUrl={avatarRef.imageUrl} alt="" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold tracking-tight text-ink">
                        {c.name}
                      </span>
                      <span className="block truncate text-[12px] text-ink-faint">
                        @{c.instagramUsername} · {count} {count === 1 ? "item" : "items"}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  /* ---------------- scheduling actions ---------------- */

  async function attachToDay(item: Post, dayKey: string) {
    if (item.stage === "content") {
      // Content only gets a DAY. The publishing time is chosen when the
      // scheduler creates the actual post.
      const [y, m, d] = dayKey.split("-").map(Number);
      const iso = new Date(y, m - 1, d, 0, 0).toISOString();
      await mutate(async (repo) => {
        await repo.updatePost(item.id, { scheduledAt: iso });
        await repo.recordActivity({
          clientId: item.clientId,
          type: "post_scheduled",
          description: `Content “${item.name || "Untitled"}” placed on ${dayKeyToNumeric(dayKey)}`,
        });
      });
      toast("Content placed — open it to create the post");
      return;
    }
    const iso = item.scheduledAt
      ? moveIsoToDay(item.scheduledAt, dayKey)
      : (() => {
          const [y, m, d] = dayKey.split("-").map(Number);
          return new Date(y, m - 1, d, 18, 0).toISOString();
        })();
    await mutate(async (repo) => {
      await repo.updatePost(item.id, { scheduledAt: iso, status: "scheduled" });
      await repo.recordActivity({
        clientId: item.clientId,
        type: "post_scheduled",
        description: `“${item.name || "Post"}” rescheduled`,
      });
    });
    toast("Post rescheduled");
  }

  async function unscheduleItem(item: Post) {
    await mutate((repo) =>
      repo.updatePost(item.id, {
        scheduledAt: null,
        status: item.stage === "content" || item.status !== "published" ? "draft" : item.status,
      }),
    );
    toast(item.stage === "content" ? "Content returned to Unscheduled" : "Post returned to Unscheduled");
  }

  async function dropOnDay(dayKey: string) {
    const item = clientItems.find((p) => p.id === draggingId);
    setDraggingId(null);
    setDropDay(null);
    if (item) await attachToDay(item, dayKey);
  }

  const chipHandlers = {
    media: snapshot.media,
    draggingId,
    onOpen: (item: Post) =>
      router.push(`/clients/${item.clientId}/posts/${item.id}?from=calendar`),
    onDragStartChip: (id: string) => setDraggingId(id),
    onDragEndChip: () => {
      setDraggingId(null);
      setDropDay(null);
      setOverUnschedule(false);
    },
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setMonthState(next.getFullYear(), next.getMonth());
  }

  const scheduledCount = contentItems.filter((p) => p.scheduledAt).length;

  return (
    <div className="space-y-5">
      {/* Toolbar: month nav + client switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="flex size-9 items-center justify-center rounded-lg border border-line bg-panel text-ink-soft hover:text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="flex size-9 items-center justify-center rounded-lg border border-line bg-panel text-ink-soft hover:text-ink"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => setMonthState(today.getFullYear(), today.getMonth())}
          className="rounded-lg px-2 py-1 text-[12px] font-medium text-ink-soft hover:bg-panel hover:text-ink"
        >
          Today
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[12px] text-ink-faint sm:inline">Client</span>
          <select
            value={client.id}
            onChange={(e) => selectClient(e.target.value)}
            aria-label="Switch client"
            className="h-9 max-w-48 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] font-medium text-ink focus:border-line-strong focus:outline-none"
          >
            {snapshot.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Month grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px] overflow-hidden rounded-xl border border-line bg-panel shadow-panel">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint"
              >
                {day}
              </div>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="grid grid-cols-7 divide-x divide-line border-b border-line last:border-b-0"
            >
              {week.days.map((day) => {
                const key = dayKeyFor(day);
                const inMonth = isSameMonth(day, year, month);
                const items = byDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      if (!draggingId) return;
                      e.preventDefault();
                      setDropDay(key);
                    }}
                    onDragLeave={() => {
                      if (dropDay === key) setDropDay(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      void dropOnDay(key);
                    }}
                    className={cn(
                      "min-h-24 space-y-1 p-1.5 align-top",
                      !inMonth && "bg-panel-raised/60",
                      dropDay === key && draggingId && "bg-accent-soft/70",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-5.5 items-center justify-center rounded-full text-[11px]",
                        isToday(day)
                          ? "bg-ink font-semibold text-panel"
                          : inMonth
                            ? "text-ink-soft"
                            : "text-ink-faint",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {items.map((item) => (
                      <PostChip key={item.id} post={item} {...chipHandlers} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Content section — also a drop target for unscheduling */}
      <section
        aria-labelledby="content-heading"
        onDragOver={(e) => {
          const dragged = clientItems.find((p) => p.id === draggingId);
          if (!dragged?.scheduledAt) return;
          e.preventDefault();
          setOverUnschedule(true);
        }}
        onDragLeave={() => setOverUnschedule(false)}
        onDrop={(e) => {
          e.preventDefault();
          const dragged = clientItems.find((p) => p.id === draggingId);
          setDraggingId(null);
          setOverUnschedule(false);
          if (dragged?.scheduledAt) void unscheduleItem(dragged);
        }}
        className={cn(
          "rounded-xl border border-transparent transition-colors",
          overUnschedule && draggingId && "border-dashed border-accent bg-accent-soft/40",
        )}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 id="content-heading" className="text-[15px] font-semibold tracking-tight text-ink">
            Content
          </h3>
          <span className="text-[12px] text-ink-faint">
            {contentItems.length} {contentItems.length === 1 ? "package" : "packages"} ·{" "}
            {scheduledCount} placed
            {draggingId ? " — drop a scheduled item here to unschedule" : ""}
          </span>
          <div
            role="radiogroup"
            aria-label="Filter content"
            className="ml-auto flex rounded-lg border border-line bg-panel p-0.5"
          >
            {(
              [
                { id: "all", label: "All" },
                { id: "unscheduled", label: "Unscheduled" },
                { id: "scheduled", label: "Scheduled" },
              ] as Array<{ id: ContentFilter; label: string }>
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={contentFilter === option.id}
                onClick={() => setContentFilter(option.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                  contentFilter === option.id
                    ? "bg-ink text-panel"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={() => setAddContentOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add content
          </Button>
        </div>

        {filteredContent.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={contentItems.length === 0 ? "No content yet" : "Nothing here"}
            description={
              contentItems.length === 0
                ? `Upload the first content package for ${client.name} — a name and the original files are enough.`
                : "No content matches this filter."
            }
            action={
              contentItems.length === 0 ? (
                <Button variant="primary" onClick={() => setAddContentOpen(true)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add content
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            {filteredContent.map((item) => (
              <ContentCard
                key={item.id}
                post={item}
                {...chipHandlers}
                onSchedule={(p) => setSchedulingPost(p)}
                onUnschedule={(p) => void unscheduleItem(p)}
              />
            ))}
          </div>
        )}
      </section>

      <AddContentDialog
        open={addContentOpen}
        onClose={() => setAddContentOpen(false)}
        clientId={client.id}
        existingCount={clientItems.length}
      />

      {/* Touch/keyboard-friendly placement fallback (date only for content) */}
      {schedulingPost && (
        <PlaceContentDialog
          post={schedulingPost}
          onClose={() => setSchedulingPost(null)}
          onSave={async (dayKey) => {
            await attachToDay(schedulingPost, dayKey);
            setSchedulingPost(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Place-on-day dialog (touch + keyboard alternative to drag-and-drop)       */
/* ------------------------------------------------------------------------- */

function PlaceContentDialog({
  post,
  onClose,
  onSave,
}: {
  post: Post;
  onClose: () => void;
  onSave: (dayKey: string) => Promise<void>;
}) {
  const initial = post.scheduledAt
    ? dayKeyToNumeric(localPartsFromIso(post.scheduledAt).day)
    : dayKeyToNumeric(dayKeyFor(new Date()));
  const [dateText, setDateText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onClose={onClose} title={`Schedule “${post.name || "content"}”`}>
      <div className="space-y-3">
        <TextField
          label="Date (DD/MM/YYYY)"
          value={dateText}
          onChange={(e) => {
            setDateText(e.target.value);
            setError(null);
          }}
          placeholder="21/07/2026"
          error={error ?? undefined}
        />
        {post.stage === "content" && (
          <p className="text-[12px] text-ink-faint">
            The publishing time is chosen when the post is created from this content.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              const dayKey = numericToDayKey(dateText);
              if (!dayKey) {
                setError("Use the DD/MM/YYYY format, e.g. 21/07/2026.");
                return;
              }
              setBusy(true);
              try {
                await onSave(dayKey);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Schedule"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
