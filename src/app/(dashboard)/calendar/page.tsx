"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Film, Image as ImageIcon, Layers } from "lucide-react";
import { MediaArt } from "@/components/instagram/media-art";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  dayKeyFor,
  formatTime,
  isSameMonth,
  isToday,
  localDayKey,
  monthGrid,
  moveIsoToDay,
} from "@/lib/dates";
import { coverMediaFor, parseMediaRef } from "@/lib/instagram/map-profile";
import { useMutate, useWorkspace } from "@/lib/store/hooks";
import type { Post, PostType } from "@/types/domain";

const typeIcons: Record<PostType, typeof ImageIcon> = {
  image: ImageIcon,
  carousel: Layers,
  reel: Film,
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const { status, snapshot } = useWorkspace();
  const mutate = useMutate();
  const { toast } = useToast();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [clientFilter, setClientFilter] = useState("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  const weeks = useMemo(() => monthGrid(year, month), [year, month]);

  const { byDay, unscheduled } = useMemo(() => {
    const map = new Map<string, Post[]>();
    const rest: Post[] = [];
    if (snapshot) {
      for (const post of snapshot.posts) {
        if (clientFilter !== "all" && post.clientId !== clientFilter) continue;
        if (post.scheduledAt) {
          const key = localDayKey(post.scheduledAt);
          map.set(key, [...(map.get(key) ?? []), post]);
        } else if (post.status === "draft") {
          rest.push(post);
        }
      }
      for (const list of map.values()) {
        list.sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
      }
    }
    return { byDay: map, unscheduled: rest };
  }, [snapshot, clientFilter]);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  const clientById = new Map(snapshot.clients.map((c) => [c.id, c]));
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  async function dropOnDay(dayKey: string) {
    const post = snapshot!.posts.find((p) => p.id === draggingId);
    setDraggingId(null);
    setDropDay(null);
    if (!post) return;
    // Preserve the existing local time of day; default 18:00 for fresh schedules.
    const iso = post.scheduledAt
      ? moveIsoToDay(post.scheduledAt, dayKey)
      : (() => {
          const [y, m, d] = dayKey.split("-").map(Number);
          return new Date(y, m - 1, d, 18, 0).toISOString();
        })();
    await mutate(async (repo) => {
      await repo.updatePost(post.id, { scheduledAt: iso, status: "scheduled" });
      await repo.recordActivity({
        clientId: post.clientId,
        type: "post_scheduled",
        description: "Post rescheduled from the calendar",
      });
    });
    toast("Post rescheduled");
  }

  function PostChip({ post }: { post: Post }) {
    const client = clientById.get(post.clientId);
    const cover = coverMediaFor(post, snapshot!.media);
    const ref = parseMediaRef(cover?.thumbnailUrl ?? cover?.url ?? null);
    const TypeIcon = typeIcons[post.type];
    return (
      <Link
        href={`/clients/${post.clientId}/posts/${post.id}`}
        draggable
        onDragStart={(e) => {
          setDraggingId(post.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDropDay(null);
        }}
        className={cn(
          "group flex items-center gap-1.5 rounded-md border border-line bg-panel px-1.5 py-1 text-left shadow-panel transition-opacity hover:border-line-strong",
          draggingId === post.id && "opacity-40",
        )}
        title={`${client?.name ?? ""} — ${post.caption || "post"}`}
      >
        <span className="relative block size-5 shrink-0 overflow-hidden rounded-sm">
          <MediaArt art={ref.art} imageUrl={ref.imageUrl} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium leading-tight text-ink">
          {client?.name}
        </span>
        <TypeIcon className="size-3 shrink-0 text-ink-faint" aria-hidden="true" />
        {post.scheduledAt && (
          <span className="hidden shrink-0 font-mono text-[9.5px] text-ink-faint xl:inline">
            {formatTime(post.scheduledAt)}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="space-y-5">
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
          onClick={() => {
            setYear(today.getFullYear());
            setMonth(today.getMonth());
          }}
          className="rounded-lg px-2 py-1 text-[12px] font-medium text-ink-soft hover:bg-panel hover:text-ink"
        >
          Today
        </button>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          aria-label="Filter by client"
          className="ml-auto h-9 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] text-ink focus:border-line-strong focus:outline-none"
        >
          <option value="all">All clients</option>
          {snapshot.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {/* Month grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px] overflow-hidden rounded-xl border border-line bg-panel shadow-panel">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                {day}
              </div>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 divide-x divide-line border-b border-line last:border-b-0">
              {week.days.map((day) => {
                const key = dayKeyFor(day);
                const inMonth = isSameMonth(day, year, month);
                const posts = byDay.get(key) ?? [];
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
                    {posts.map((post) => (
                      <PostChip key={post.id} post={post} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Unscheduled tray */}
      <section aria-labelledby="unscheduled-heading">
        <h3 id="unscheduled-heading" className="mb-2 text-[13.5px] font-semibold tracking-tight text-ink">
          Unscheduled drafts
          <span className="ml-2 text-[12px] font-normal text-ink-faint">
            drag onto a day to schedule
          </span>
        </h3>
        {unscheduled.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing waiting"
            description="Draft posts without a date will appear here, ready to drag onto the calendar."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((post) => (
              <div key={post.id} className="w-44">
                <PostChip post={post} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
