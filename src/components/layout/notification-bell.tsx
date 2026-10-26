"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Bell, BellOff, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/dates";
import { onWorkspaceChange } from "@/lib/repositories/demo-channel";
import { useAction, useWorkspace } from "@/lib/store/hooks";
import { notificationsRead } from "@/lib/store/patches";
import { workspaceStore } from "@/lib/store/workspace-store";
import type { AppNotification } from "@/types/domain";

/**
 * Functional notification bell: unread badge, dropdown list, mark-read, and
 * live updates (Supabase Realtime in live mode, BroadcastChannel across tabs
 * in demo mode, plus refresh-on-focus as the universal fallback).
 */
export function NotificationBell() {
  const { status, snapshot, mode } = useWorkspace();
  const run = useAction();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const userId = snapshot?.user.id ?? null;

  const notifications = useMemo(
    () =>
      (snapshot?.notifications ?? [])
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [snapshot],
  );
  const unread = notifications.filter((n) => !n.isRead).length;
  const clientName = (clientId: string) =>
    snapshot?.clients.find((c) => c.id === clientId)?.name ?? "";

  /* Live updates ---------------------------------------------------------- */

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let stopDemoListener: (() => void) | null = null;

    if (mode === "supabase") {
      void (async () => {
        const { getBrowserSupabase } = await import("@/lib/supabase/client");
        if (cancelled) return;
        channel = getBrowserSupabase()
          .channel(`notifications-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `recipient_id=eq.${userId}`,
            },
            () => void workspaceStore.refreshSoon(),
          )
          .subscribe();
      })();
    } else {
      // Demo mode: other tabs announce persisted changes (the repository
      // listens too and drops its cache before this refresh runs).
      stopDemoListener = onWorkspaceChange(() => void workspaceStore.refreshSoon());
    }

    // Change signals above are coalesced, never skipped. Focus is only a
    // fallback, so it's skipped if the workspace refreshed in the last 30 s.
    const onFocus = () => void workspaceStore.refreshIfStale(30_000);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (channel) void channel.unsubscribe();
      stopDemoListener?.();
      window.removeEventListener("focus", onFocus);
    };
  }, [mode, userId]);

  /* Open/close behavior --------------------------------------------------- */

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  /* Actions --------------------------------------------------------------- */

  async function openNotification(notification: AppNotification) {
    setOpen(false);
    if (!notification.isRead) {
      // A failed mark-read shows a toast but never blocks opening the post.
      await run(
        (repo) => repo.markNotificationRead(notification.id),
        notificationsRead([notification.id]),
      );
    }
    if (notification.postId) {
      router.push(`/clients/${notification.clientId}/posts/${notification.postId}?focus=review`);
    } else {
      router.push(`/clients/${notification.clientId}`);
    }
  }

  const badgeText = unread > 9 ? "9+" : String(unread);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative flex size-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-panel hover:text-ink"
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9.5px] font-semibold leading-none text-white"
          >
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          tabIndex={-1}
          className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-panel shadow-panel-hover focus:outline-none"
        >
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">Notifications</h2>
            {unread > 0 && (
              <span className="text-[11.5px] text-ink-faint">{unread} unread</span>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  void run((repo) => repo.markAllNotificationsRead(), notificationsRead("all"))
                }
                disabled={unread === 0}
                className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11.5px] font-medium text-ink-soft hover:text-ink disabled:opacity-40"
              >
                <CheckCheck className="size-3.5" aria-hidden="true" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {status === "loading" || status === "idle" ? (
              <div className="space-y-2 p-3.5" role="status" aria-label="Loading notifications">
                <div className="h-10 animate-pulse rounded-lg bg-panel-raised" />
                <div className="h-10 animate-pulse rounded-lg bg-panel-raised" />
              </div>
            ) : status === "error" ? (
              <p className="px-3.5 py-6 text-center text-[12.5px] text-ink-soft">
                Couldn&apos;t load notifications — check your connection and try again.
              </p>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center px-3.5 py-8 text-center">
                <BellOff className="size-5 text-ink-faint" aria-hidden="true" />
                <p className="mt-2 text-[12.5px] text-ink-soft">You&apos;re all caught up.</p>
                <p className="text-[11.5px] text-ink-faint">
                  Client reviews and approvals will show up here.
                </p>
              </div>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="flex items-start gap-1 border-b border-line px-1.5 py-1 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className={cn(
                        "flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-panel-raised",
                        !notification.isRead && "bg-accent-soft/40",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          notification.isRead ? "bg-line-strong" : "bg-accent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-ink">
                          {notification.title}
                          {!notification.isRead && <span className="sr-only"> (unread)</span>}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-ink-soft">
                          {notification.message}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-ink-faint">
                          {clientName(notification.clientId)} · {formatRelative(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                    {!notification.isRead && (
                      <button
                        type="button"
                        aria-label={`Mark "${notification.title}" as read`}
                        onClick={() =>
                          void run(
                            (repo) => repo.markNotificationRead(notification.id),
                            notificationsRead([notification.id]),
                          )
                        }
                        className="mt-2 flex size-7 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel-raised hover:text-ink"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
