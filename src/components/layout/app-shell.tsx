"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { useWorkspace } from "@/lib/store/hooks";
import { workspaceStore } from "@/lib/store/workspace-store";
import { PendingApprovalScreen } from "./pending-approval-screen";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * Workspace load/refresh failures for every dashboard page in one place: a
 * workspace that never loaded shows an error with Retry (instead of each
 * page's skeleton spinning forever); a failed background refresh keeps the
 * last loaded data visible with a notice.
 */
function WorkspaceGate({ children }: { children: ReactNode }) {
  const { status, error, snapshot } = useWorkspace();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    await workspaceStore.refresh(!snapshot);
    setRetrying(false);
  }

  if (status === "error" && !snapshot) {
    return (
      <EmptyState
        icon={CloudOff}
        title="Couldn't load your workspace"
        description={`${error ?? "Something went wrong."} Check your connection and try again.`}
        action={
          <Button variant="primary" onClick={() => void retry()} disabled={retrying}>
            <RotateCw className="size-3.5" aria-hidden="true" />
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        }
      />
    );
  }

  return (
    <>
      {error && snapshot && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-accent-soft px-3 py-2 text-[12.5px] text-accent-deep"
        >
          <CloudOff className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Couldn&apos;t refresh your workspace — showing what was loaded earlier.
          </span>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="font-medium underline-offset-2 hover:underline disabled:opacity-60"
          >
            {retrying ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}
      {children}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { snapshot } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileNav();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen, closeMobileNav]);

  // Pending or suspended: no sidebar, no pages — only the waiting screen.
  if (snapshot && snapshot.user.status !== "approved") return <PendingApprovalScreen user={snapshot.user} />;

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-panel"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-dvh shrink-0 border-r border-line transition-[width] duration-300 ease-in-out lg:block",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
        />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMobileNav}
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
              aria-hidden="true"
            />
            <motion.div
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-line shadow-panel-hover lg:hidden"
            >
              <button
                type="button"
                onClick={closeMobileNav}
                aria-label="Close navigation menu"
                autoFocus
                className="absolute right-3 top-3.5 z-10 flex size-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
              <Sidebar collapsed={false} onNavigate={closeMobileNav} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <WorkspaceGate>{children}</WorkspaceGate>
          </div>
        </main>
      </div>
    </div>
  );
}
