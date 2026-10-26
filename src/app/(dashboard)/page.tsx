"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CircleCheck,
  Film,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Plus,
  Send,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ClientCard } from "@/components/clients/client-card";
import { MediaArt } from "@/components/instagram/media-art";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ApprovalBadge } from "@/components/ui/status-badge";
import { formatRelative, formatShortDate, formatTime } from "@/lib/dates";
import {
  clientsSortedByUpdate,
  dashboardStats,
  postsForClient,
  upcomingScheduledPosts,
} from "@/lib/derive";
import { coverMediaFor, parseMediaRef } from "@/lib/instagram/map-profile";
import { useWorkspace } from "@/lib/store/hooks";
import type { ActivityType, PostType } from "@/types/domain";

const typeConfig: Record<PostType, { label: string; icon: LucideIcon }> = {
  image: { label: "Post", icon: ImageIcon },
  carousel: { label: "Carousel", icon: Layers },
  reel: { label: "Reel", icon: Film },
};

const activityIcons: Record<ActivityType, { icon: LucideIcon; className: string }> = {
  approval_received: { icon: CircleCheck, className: "bg-emerald-50 text-emerald-700" },
  changes_requested: { icon: MessageSquare, className: "bg-amber-50 text-amber-700" },
  comment_received: { icon: MessageSquare, className: "bg-amber-50 text-amber-700" },
  share_link_created: { icon: Send, className: "bg-accent-soft text-accent-deep" },
  post_created: { icon: Upload, className: "bg-panel-raised text-ink-soft" },
  post_updated: { icon: Upload, className: "bg-panel-raised text-ink-soft" },
  post_scheduled: { icon: CalendarDays, className: "bg-panel-raised text-ink-soft" },
  highlight_created: { icon: Upload, className: "bg-panel-raised text-ink-soft" },
  client_created: { icon: UserPlus, className: "bg-panel-raised text-ink-soft" },
  client_updated: { icon: UserPlus, className: "bg-panel-raised text-ink-soft" },
};

export default function OverviewPage() {
  const { status, snapshot } = useWorkspace();
  const router = useRouter();

  // Load failures are handled for every page by the app shell.
  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  const stats = dashboardStats(snapshot);
  const recentClients = clientsSortedByUpdate(snapshot).slice(0, 4);
  const upcoming = upcomingScheduledPosts(snapshot, 5);
  const activity = snapshot.activity.slice(0, 5);
  const firstName = snapshot.user.displayName.split(" ")[0];
  const clientById = new Map(snapshot.clients.map((c) => [c.id, c]));

  const statCards = [
    { id: "clients", label: "Active clients", value: stats.activeClients, hint: "Across your studio" },
    { id: "drafts", label: "Draft posts", value: stats.draftPosts, hint: "Waiting to be scheduled" },
    { id: "awaiting", label: "Awaiting approval", value: stats.awaitingApproval, hint: "Sent to clients for review" },
    { id: "scheduled", label: "Scheduled this month", value: stats.scheduledThisMonth, hint: "On the calendar" },
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      <FadeIn order={0}>
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Welcome back, {firstName}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft sm:text-sm">
            {stats.awaitingApproval > 0
              ? `${stats.awaitingApproval} ${stats.awaitingApproval === 1 ? "post is" : "posts are"} waiting on client approval.`
              : "Everything is up to date."}{" "}
            {upcoming.length > 0 &&
              `Next scheduled post goes out ${formatShortDate(upcoming[0].scheduledAt!)} at ${formatTime(upcoming[0].scheduledAt!)}.`}
          </p>
        </div>
      </FadeIn>

      <FadeIn order={1}>
        <section aria-label="Summary">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {statCards.map((stat) => (
              <div key={stat.id} className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
                  {stat.label}
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-ink tabular-nums sm:text-[28px]">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-[12.5px] text-ink-soft">{stat.hint}</p>
              </div>
            ))}
          </div>
        </section>
      </FadeIn>

      <FadeIn order={2}>
        <section aria-labelledby="recent-clients-heading">
          <SectionHeader
            title="Recent client projects"
            headingId="recent-clients-heading"
            description="Workspaces with the latest changes"
            href="/clients"
            linkLabel="All clients"
          />
          {recentClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Create your first client to start planning their Instagram grid."
              action={
                <Button variant="primary" onClick={() => router.push("/clients?new=1")}>
                  <Plus className="size-4" aria-hidden="true" />
                  New client
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recentClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  posts={postsForClient(snapshot, client.id)}
                  media={snapshot.media}
                />
              ))}
            </div>
          )}
        </section>
      </FadeIn>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.6fr_1fr] xl:gap-6">
        <FadeIn order={3} className="min-w-0">
          <section aria-labelledby="upcoming-heading">
            <SectionHeader
              title="Upcoming content"
              headingId="upcoming-heading"
              description="Scheduled across all clients"
              href="/calendar"
              linkLabel="Open calendar"
            />
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing scheduled"
                description="Schedule posts from a client workspace or the calendar."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-panel">
                <ul className="divide-y divide-line">
                  {upcoming.map((post) => {
                    const client = clientById.get(post.clientId);
                    const cover = coverMediaFor(post, snapshot.media);
                    const ref = parseMediaRef(cover?.thumbnailUrl ?? cover?.url ?? null);
                    const type = typeConfig[post.type];
                    return (
                      <li key={post.id}>
                        <Link
                          href={`/clients/${post.clientId}/posts/${post.id}`}
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-panel-raised sm:flex-nowrap sm:px-5"
                        >
                          <span className="w-14 shrink-0">
                            <span className="block font-mono text-[12px] font-medium text-ink">
                              {formatShortDate(post.scheduledAt!)}
                            </span>
                            <span className="block font-mono text-[11px] text-ink-faint">
                              {formatTime(post.scheduledAt!)}
                            </span>
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-3">
                            <span className="relative block h-10 w-8 shrink-0 overflow-hidden rounded border border-line">
                              <MediaArt art={ref.art} imageUrl={ref.imageUrl} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px] font-medium text-ink">
                                {post.caption || "(no caption yet)"}
                              </span>
                              <span className="block truncate text-[12px] text-ink-faint">
                                {client?.name}
                              </span>
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-panel-raised px-2 py-1 text-[11.5px] font-medium text-ink-soft">
                            <type.icon className="size-3.5 text-ink-faint" aria-hidden="true" />
                            {type.label}
                          </span>
                          <ApprovalBadge status={post.approvalStatus} className="shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </FadeIn>

        <FadeIn order={4} className="min-w-0">
          <section aria-labelledby="activity-heading">
            <SectionHeader title="Recent activity" headingId="activity-heading" description="Last 7 days" />
            {activity.length === 0 ? (
              <EmptyState
                icon={Send}
                title="No activity yet"
                description="Client approvals, comments, and scheduling events show up here."
              />
            ) : (
              <div className="rounded-xl border border-line bg-panel shadow-panel">
                <ol className="divide-y divide-line">
                  {activity.map((item) => {
                    const config = activityIcons[item.type];
                    return (
                      <li key={item.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${config.className}`}
                          aria-hidden="true"
                        >
                          <config.icon className="size-3.5" />
                        </span>
                        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink">
                          {item.description}
                        </p>
                        <time className="shrink-0 pt-0.5 font-mono text-[11px] text-ink-faint">
                          {formatRelative(item.createdAt)}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>
        </FadeIn>
      </div>
    </div>
  );
}
