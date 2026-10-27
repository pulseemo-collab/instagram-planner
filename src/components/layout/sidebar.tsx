"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Grid3x3, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { navItems } from "@/lib/navigation";
import { useWorkspace } from "@/lib/store/hooks";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  /** Called after a nav link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ collapsed, onToggleCollapsed, onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const { snapshot } = useWorkspace();
  const user = snapshot?.user;
  const isOwner = user?.role === "owner";
  const initials =
    (user?.displayName ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "·";

  return (
    <div className={cn("flex h-full flex-col bg-panel", className)}>
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 items-center gap-2.5 border-b border-line",
          collapsed ? "justify-center px-2" : "px-5",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ink text-panel">
          <Grid3x3 className="size-4" aria-hidden="true" />
        </span>
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold tracking-tight text-ink">
            Gridline<span className="text-ink-faint"> Studio</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.filter((item) => !item.ownerOnly || isOwner).map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-canvas text-ink"
                      : "text-ink-soft hover:bg-canvas/60 hover:text-ink",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      active ? "text-accent" : "text-ink-faint group-hover:text-ink-soft",
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle (desktop only) */}
      {onToggleCollapsed && (
        <div className={cn("px-3 pb-2", collapsed && "flex justify-center")}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-faint transition-colors hover:bg-canvas/60 hover:text-ink",
              collapsed ? "justify-center px-2" : "w-full",
            )}
          >
            {collapsed ? (
              <PanelLeft className="size-[18px]" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* User profile */}
      <div className="border-t border-line p-3">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-canvas/60",
            collapsed && "justify-center",
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-deep"
          >
            {initials}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {user?.displayName ?? ""}
                </span>
                <span className="block truncate text-[11.5px] text-ink-faint">
                  {user ? (isOwner ? "Workspace owner" : "Team member") : ""}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
            </>
          )}
          <span className="sr-only">Open account menu</span>
        </button>
      </div>
    </div>
  );
}
