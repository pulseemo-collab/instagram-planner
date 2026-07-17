"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { authMode, hasDemoSession } from "@/lib/auth/session";

function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  return authMode() === "supabase" || hasDemoSession();
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Client-side gate for the dashboard shell in demo mode. In Supabase mode the
 * proxy performs the redirect server-side, so this resolves immediately.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authorized = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Read the session directly — the rendered `authorized` value is still the
    // server snapshot (false) during hydration, which must not trigger a redirect.
    if (authMode() === "demo" && !hasDemoSession()) {
      router.replace("/login");
    }
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3" role="status" aria-label="Loading">
          <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
          <span className="text-[13px] text-ink-faint">Loading workspace…</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
