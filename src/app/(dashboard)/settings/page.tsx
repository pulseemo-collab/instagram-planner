"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, LogOut, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/field";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { authMode, endDemoSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/repositories";
import { workspaceStore } from "@/lib/store/workspace-store";
import { useAction, useWorkspace } from "@/lib/store/hooks";
import { getPreferences, setPreferences, type AppPreferences } from "@/lib/preferences";

export default function SettingsPage() {
  const { status, snapshot, mode } = useWorkspace();
  const run = useAction();
  const router = useRouter();
  const { toast } = useToast();

  // null = "not edited yet" — the input falls back to the stored display name.
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AppPreferences>(() =>
    typeof window === "undefined" ? { defaultTheme: "light", defaultApprovals: "comments_and_approvals" } : getPreferences(),
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  const displayName = displayNameDraft ?? snapshot.user.displayName;

  function updatePrefs(patch: Partial<AppPreferences>) {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      setPreferences(next);
      return next;
    });
  }

  async function saveProfile() {
    setBusy(true);
    const result = await run((repo) =>
      repo.updateUser({ displayName: displayName.trim() || "Studio owner" }),
    );
    setBusy(false);
    if (result.ok) toast("Profile saved");
  }

  async function signOut() {
    if (authMode() === "supabase") {
      const { getBrowserSupabase } = await import("@/lib/supabase/client");
      await getBrowserSupabase().auth.signOut();
    } else {
      endDemoSession();
    }
    await workspaceStore.reset();
    router.replace("/login");
    router.refresh();
  }

  async function resetDemo(seed: boolean) {
    setBusy(true);
    try {
      const repo = await getRepository();
      await repo.resetDemoData?.(seed);
      await workspaceStore.refresh();
      toast(seed ? "Demo data restored" : "All data cleared");
      setResetOpen(false);
      setClearOpen(false);
    } catch {
      toast("Couldn't reset the demo data. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="max-w-2xl space-y-5">
      <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">Your profile</h2>
        <div className="mt-3 space-y-3">
          <TextField
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayNameDraft(e.target.value)}
          />
          <TextField label="Email" value={snapshot.user.email} readOnly disabled />
          <Button variant="primary" onClick={() => void saveProfile()} disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">Defaults</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Default preview theme"
            hint="Used for newly created clients."
            value={prefs.defaultTheme}
            onChange={(e) => updatePrefs({ defaultTheme: e.target.value as AppPreferences["defaultTheme"] })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectField>
          <SelectField
            label="Default approval flow"
            hint="Preselected on new share links."
            value={prefs.defaultApprovals}
            onChange={(e) =>
              updatePrefs({ defaultApprovals: e.target.value as AppPreferences["defaultApprovals"] })
            }
          >
            <option value="comments_and_approvals">Comments + approvals</option>
            <option value="comments_only">Comments only</option>
            <option value="view_only">View only</option>
          </SelectField>
        </div>
        <p className="mt-3 text-[12px] text-ink-faint">
          Timezone: <span className="font-medium text-ink-soft">{timezone}</span> (detected from your
          system — scheduling always uses local time).
        </p>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink">
          <Database className="size-4 text-ink-faint" aria-hidden="true" />
          Data
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          {mode === "demo" ? (
            <>
              You&apos;re in <strong>demo mode</strong> — everything is stored locally in this
              browser (IndexedDB). Connect Supabase via <code className="font-mono text-[11.5px]">.env.local</code> for
              live multi-device data.
            </>
          ) : (
            <>
              Connected to <strong>Supabase</strong> — data is stored in your project&apos;s Postgres
              database and storage buckets.
            </>
          )}
        </p>
        {mode === "demo" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => setResetOpen(true)}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Restore demo data
            </Button>
            <Button onClick={() => setClearOpen(true)}>
              <Trash2 className="size-3.5 text-red-700" aria-hidden="true" />
              Delete all data
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">Session</h2>
        <Button className="mt-3" onClick={() => void signOut()}>
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </Button>
      </section>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => void resetDemo(true)}
        title="Restore demo data?"
        body="Your current local data is replaced with the original three demo clients."
        confirmLabel="Restore demo data"
        busy={busy}
      />
      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => void resetDemo(false)}
        title="Delete all local data?"
        body="Every client, post, upload, comment, and share link stored in this browser is permanently deleted. You start from an empty workspace."
        confirmLabel="Delete everything"
        destructive
        busy={busy}
      />
    </div>
  );
}
