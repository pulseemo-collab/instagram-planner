"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Plus, Search } from "lucide-react";
import { getPageTitle } from "@/lib/navigation";

interface TopBarProps {
  onOpenMobileNav: () => void;
}

export function TopBar({ onOpenMobileNav }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-sm sm:gap-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation menu"
        className="-ml-1 flex size-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-panel hover:text-ink lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-ink sm:text-base">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search clients, posts…"
            aria-label="Search clients and posts"
            className="h-9 w-56 rounded-lg border border-line bg-panel pl-9 pr-12 text-[13px] text-ink placeholder:text-ink-faint transition-[width,border-color] duration-200 focus:w-72 focus:border-line-strong focus:outline-none lg:w-64"
          />
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-panel-raised px-1.5 font-mono text-[10px] text-ink-faint"
          >
            ⌘K
          </kbd>
        </div>
        <button
          type="button"
          aria-label="Search"
          className="flex size-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-panel hover:text-ink md:hidden"
        >
          <Search className="size-[18px]" aria-hidden="true" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications (2 unread)"
          className="relative flex size-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-panel hover:text-ink"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 size-1.5 rounded-full bg-accent"
          />
        </button>

        {/* Primary action */}
        <button
          type="button"
          onClick={() => router.push("/clients?new=1")}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-medium text-panel shadow-panel transition-colors hover:bg-ink/85 sm:px-4"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">New client</span>
          <span className="sr-only sm:hidden">New client</span>
        </button>
      </div>
    </header>
  );
}
