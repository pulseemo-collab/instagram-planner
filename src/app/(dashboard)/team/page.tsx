"use client";

import { useEffect, useState } from "react";
import { Ban, Check, Lock, RotateCw, Undo2, UserCheck, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatRelative } from "@/lib/dates";
import { getRepository } from "@/lib/repositories";
import type { Repository } from "@/lib/repositories/types";
import { useAction, useWorkspace } from "@/lib/store/hooks";
import type { TeamMember } from "@/types/domain";

type Action = "approve" | "reject" | "suspend" | "restore" | "remove";
type Decision = { member: TeamMember; action: Action };

const nameOf = (member: TeamMember) => member.displayName || member.email;

/** Confirmation text and success toast for each action. */
const ACTIONS: Record<
  Action,
  { verb: string; body: string; confirm: string; destructive: boolean; done: (name: string) => string }
> = {
  approve: {
    verb: "Approve",
    body: "They get access to every client, post and share link in the workspace.",
    confirm: "Approve",
    destructive: false,
    done: (name) => `${name} can now use the workspace`,
  },
  reject: {
    verb: "Reject",
    body: "Their account is deleted permanently. They can sign up again later.",
    confirm: "Reject and delete account",
    destructive: true,
    done: (name) => `${name}'s account was deleted`,
  },
  suspend: {
    verb: "Suspend",
    body: "They lose access to everything right away, but their account is kept. You can restore them at any time.",
    confirm: "Suspend",
    destructive: true,
    done: (name) => `${name} was suspended`,
  },
  restore: {
    verb: "Restore",
    body: "They get access to every client, post and share link in the workspace again.",
    confirm: "Restore access",
    destructive: false,
    done: (name) => `${name} can use the workspace again`,
  },
  remove: {
    verb: "Remove",
    body: "Their account is deleted permanently. The clients they created move to you, so none of the team's work is lost. They can sign up again later and would need your approval.",
    confirm: "Remove and delete account",
    destructive: true,
    done: (name) => `${name} was removed from the team`,
  },
};

function perform(repo: Repository, { member, action }: Decision): Promise<void> {
  switch (action) {
    case "approve":
      return repo.approveMember(member.id);
    case "reject":
      return repo.rejectMember(member.id);
    case "suspend":
      return repo.suspendMember(member.id);
    case "restore":
      return repo.restoreMember(member.id);
    case "remove":
      return repo.removeMember(member.id);
  }
}

function MemberName({ member }: { member: TeamMember }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium text-ink">
        {member.displayName || member.email}
      </span>
      <span className="block truncate text-[12px] text-ink-faint">{member.email}</span>
    </span>
  );
}

/**
 * Owner-only: approve or reject new accounts; suspend, restore or remove
 * members (never the owner). Roles are not changed here — the owner is
 * appointed in the Supabase dashboard (see README).
 */
export default function TeamPage() {
  const { status, snapshot } = useWorkspace();
  const run = useAction();
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped to reload the team list (after a decision, or Retry).
  const [loadCount, setLoadCount] = useState(0);
  const reload = () => setLoadCount((count) => count + 1);

  const isOwner = snapshot?.user.role === "owner";

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    getRepository()
      .then((repo) => repo.listTeam())
      .then(
        (list) => {
          if (cancelled) return;
          setTeam(list);
          setLoadError(null);
        },
        (error: unknown) => {
          if (!cancelled) setLoadError(error instanceof Error ? error.message : "Something went wrong.");
        },
      );
    return () => {
      cancelled = true;
    };
  }, [isOwner, loadCount]);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  if (!isOwner) {
    return (
      <EmptyState
        icon={Lock}
        title="Only the workspace owner can manage the team"
        description="Ask the owner if someone is waiting for approval."
      />
    );
  }

  if (loadError && !team) {
    return (
      <EmptyState
        icon={UserCheck}
        title="Couldn't load the team"
        description={`${loadError} Check your connection and try again.`}
        action={
          <Button variant="primary" onClick={reload}>
            <RotateCw className="size-3.5" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  if (!team) return <PageSkeleton />;

  const pending = team.filter((m) => m.status === "pending");
  const members = team.filter((m) => m.status === "approved");
  const suspended = team.filter((m) => m.status === "suspended");
  const myId = snapshot.user.id;

  async function decide() {
    if (!decision) return;
    const current = decision;
    setBusy(true);
    const result = await run((repo) => perform(repo, current));
    setBusy(false);
    setDecision(null);
    // Reload either way: a failure may mean someone else already decided.
    reload();
    if (result.ok) toast(ACTIONS[current.action].done(nameOf(current.member)));
  }

  /** Suspend / Restore and Remove — never on the owner's own row. */
  const memberActions = (member: TeamMember) =>
    member.role === "owner" || member.id === myId ? null : (
      <span className="flex gap-2">
        {member.status === "suspended" ? (
          <Button
            aria-label={`Restore ${nameOf(member)}`}
            onClick={() => setDecision({ member, action: "restore" })}
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            Restore
          </Button>
        ) : (
          <Button
            aria-label={`Suspend ${nameOf(member)}`}
            onClick={() => setDecision({ member, action: "suspend" })}
          >
            <Ban className="size-3.5" aria-hidden="true" />
            Suspend
          </Button>
        )}
        <Button
          aria-label={`Remove ${nameOf(member)}`}
          onClick={() => setDecision({ member, action: "remove" })}
        >
          <UserMinus className="size-3.5 text-red-700" aria-hidden="true" />
          Remove
        </Button>
      </span>
    );

  return (
    <div className="max-w-2xl space-y-5">
      <section
        aria-labelledby="team-pending"
        className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5"
      >
        <h2 id="team-pending" className="text-[14px] font-semibold tracking-tight text-ink">
          Waiting for approval
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          New accounts see nothing until you approve them. Rejecting deletes the account; they can
          sign up again later.
        </p>
        {pending.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-ink-faint">Nobody is waiting right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {pending.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                <MemberName member={member} />
                <span className="text-[11.5px] text-ink-faint">
                  Signed up {formatRelative(member.createdAt)}
                  {!member.emailConfirmed && " · email not confirmed"}
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="primary"
                    aria-label={`Approve ${nameOf(member)}`}
                    onClick={() => setDecision({ member, action: "approve" })}
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    Approve
                  </Button>
                  <Button
                    aria-label={`Reject ${nameOf(member)}`}
                    onClick={() => setDecision({ member, action: "reject" })}
                  >
                    <X className="size-3.5 text-red-700" aria-hidden="true" />
                    Reject
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="team-members"
        className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5"
      >
        <h2 id="team-members" className="text-[14px] font-semibold tracking-tight text-ink">
          Members
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          Everyone here works in the same workspace. Only the owner can delete clients and manage
          the team. Suspending blocks access but keeps the account; removing deletes it and moves
          the clients they created to you.
        </p>
        <ul className="mt-3 divide-y divide-line">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <MemberName member={member} />
              <span className="text-[11.5px] text-ink-faint">
                {member.role === "owner" ? "Owner" : "Member"}
                {member.approvedAt && ` · since ${formatDate(member.approvedAt)}`}
              </span>
              {memberActions(member)}
            </li>
          ))}
        </ul>
      </section>

      {suspended.length > 0 && (
        <section
          aria-labelledby="team-suspended"
          className="rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5"
        >
          <h2 id="team-suspended" className="text-[14px] font-semibold tracking-tight text-ink">
            Suspended
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            These accounts can still sign in but see nothing until you restore them.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {suspended.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                <MemberName member={member} />
                <span className="text-[11.5px] text-ink-faint">Suspended</span>
                {memberActions(member)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={decision !== null}
        onClose={() => setDecision(null)}
        onConfirm={() => void decide()}
        title={decision ? `${ACTIONS[decision.action].verb} ${nameOf(decision.member)}?` : ""}
        body={decision ? ACTIONS[decision.action].body : ""}
        confirmLabel={decision ? ACTIONS[decision.action].confirm : undefined}
        destructive={decision ? ACTIONS[decision.action].destructive : false}
        busy={busy}
      />
    </div>
  );
}
