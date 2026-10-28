"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Grid3x3, Hourglass, LogOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/sign-out";
import { workspaceStore } from "@/lib/store/workspace-store";
import type { User } from "@/types/domain";

/**
 * Shown instead of the whole dashboard while an account waits for the
 * workspace owner's approval, or after the owner suspended it. The account
 * sees no workspace data (RLS in Supabase mode returns nothing until the
 * owner approves or restores it).
 */
export function PendingApprovalScreen({ user }: { user: User }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"check" | "signout" | null>(null);

  async function checkAgain() {
    setBusy("check");
    await workspaceStore.refresh();
    setBusy(null);
  }

  async function leave() {
    setBusy("signout");
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  const isSuspended = user.status === "suspended";
  const Icon = isSuspended ? Ban : Hourglass;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-panel">
          <Grid3x3 className="size-4.5" aria-hidden="true" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">
          Gridline<span className="text-ink-faint"> Studio</span>
        </span>
      </div>
      <main
        id="main-content"
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-panel sm:p-7"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink">
          {isSuspended ? "Your access was suspended" : "Your account is waiting for approval"}
        </h1>
        {isSuspended ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            You&apos;re signed in as <strong className="text-ink">{user.email}</strong>. The
            workspace owner has paused your access to clients and content. Your account is kept —
            ask the owner to restore it, then check again.
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            You&apos;re signed in as <strong className="text-ink">{user.email}</strong>. The
            workspace owner has been notified and needs to approve your account before you can see
            clients and content. Check back once they have.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="primary" onClick={() => void checkAgain()} disabled={busy !== null}>
            <RotateCw className="size-3.5" aria-hidden="true" />
            {busy === "check" ? "Checking…" : "Check again"}
          </Button>
          <Button onClick={() => void leave()} disabled={busy !== null}>
            <LogOut className="size-3.5" aria-hidden="true" />
            {busy === "signout" ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </main>
    </div>
  );
}
