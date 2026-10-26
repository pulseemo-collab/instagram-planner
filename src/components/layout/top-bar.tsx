"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Plus, Search, X } from "lucide-react";
import { getPageTitle } from "@/lib/navigation";
import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";

const noSubscribe = () => () => {};

/** "⌘K" on Apple devices, "Ctrl K" elsewhere (server render: "⌘K"). */
function useShortcutHint(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );
}

interface TopBarProps {
  onOpenMobileNav: () => void;
}

export function TopBar({ onOpenMobileNav }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);
  const shortcutHint = useShortcutHint();
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // ⌘K / Ctrl+K focuses search from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (window.matchMedia("(min-width: 768px)").matches) {
        desktopSearchRef.current?.focus();
      } else {
        setMobileSearchOpen(true);
        mobileSearchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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
        <GlobalSearch
          inputRef={desktopSearchRef}
          shortcutHint={shortcutHint}
          className="hidden md:block"
          inputClassName="w-56 transition-[width,border-color] duration-200 focus:w-72 lg:w-64"
          listClassName="right-0 w-[22rem]"
        />
        <button
          type="button"
          aria-label={mobileSearchOpen ? "Close search" : "Search"}
          aria-expanded={mobileSearchOpen}
          aria-controls={mobileSearchOpen ? "mobile-search" : undefined}
          onClick={() => setMobileSearchOpen((value) => !value)}
          className="flex size-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-panel hover:text-ink md:hidden"
        >
          {mobileSearchOpen ? (
            <X className="size-[18px]" aria-hidden="true" />
          ) : (
            <Search className="size-[18px]" aria-hidden="true" />
          )}
        </button>

        {/* Notifications */}
        <NotificationBell />

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

      {/* Mobile: full-width search under the bar */}
      {mobileSearchOpen && (
        <div
          id="mobile-search"
          className="absolute inset-x-0 top-full border-b border-line bg-canvas px-4 py-3 md:hidden"
        >
          <GlobalSearch
            inputRef={mobileSearchRef}
            autoFocus
            onDone={() => setMobileSearchOpen(false)}
            listClassName="inset-x-0"
          />
        </div>
      )}
    </header>
  );
}
