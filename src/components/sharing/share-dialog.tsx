"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField, ToggleField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/dates";
import { PREFS_KEY, approvalFlowFlags, parsePreferences } from "@/lib/preferences";
import { useAction } from "@/lib/store/hooks";
import { shareLinkCreated, shareLinkSaved } from "@/lib/store/patches";
import { useStoredValue } from "@/lib/use-stored-value";
import type { ShareLink } from "@/types/domain";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  shareLinks: ShareLink[];
}

export function shareUrlFor(token: string): string {
  if (typeof window === "undefined") return `/share/${token}`;
  return `${window.location.origin}/share/${token}`;
}

export function ShareDialog({ open, onClose, clientId, clientName, shareLinks }: ShareDialogProps) {
  const run = useAction();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expiresDay, setExpiresDay] = useState("");
  // Start from Settings → Defaults ("default approval flow"); a switch the
  // user flips overrides it for links created from this dialog.
  const [storedPrefs] = useStoredValue(PREFS_KEY);
  const defaults = approvalFlowFlags(parsePreferences(storedPrefs).defaultApprovals);
  const [commentsOverride, setAllowComments] = useState<boolean | null>(null);
  const [approvalOverride, setAllowApproval] = useState<boolean | null>(null);
  const allowComments = commentsOverride ?? defaults.allowComments;
  const allowApproval = approvalOverride ?? defaults.allowApproval;

  const links = shareLinks.filter((l) => l.clientId === clientId);

  async function createLink() {
    setBusy(true);
    try {
      const result = await run(async (repo) => {
        const link = await repo.createShareLink({
          clientId,
          isActive: true,
          expiresAt: expiresDay ? new Date(`${expiresDay}T23:59:59`).toISOString() : null,
          allowComments,
          allowApproval,
        });
        const activity = await repo.recordActivity({
          clientId,
          type: "share_link_created",
          description: `Preview link created for ${clientName}`,
        });
        return { link, activity };
      }, shareLinkCreated);
      if (result.ok) toast("Share link created");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(shareUrlFor(link.token));
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast("Could not copy — copy the URL manually", "error");
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share preview"
      description={`Send ${clientName} a link to review and approve their feed.`}
      size="lg"
    >
      <div className="space-y-4">
        {links.length > 0 && (
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.id} className="rounded-lg border border-line bg-panel px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 shrink-0 rounded-full ${link.isActive ? "bg-emerald-500" : "bg-line-strong"}`}
                    aria-hidden="true"
                  />
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">
                    /share/{link.token}
                  </code>
                  <button
                    type="button"
                    aria-label="Copy link"
                    onClick={() => void copyLink(link)}
                    className="flex size-7 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-canvas hover:text-ink"
                  >
                    {copiedId === link.id ? (
                      <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                  <a
                    href={shareUrlFor(link.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open preview in new tab"
                    className="flex size-7 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-canvas hover:text-ink"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-faint">
                  <span>Created {formatDate(link.createdAt)}</span>
                  <span>{link.expiresAt ? `Expires ${formatDate(link.expiresAt)}` : "No expiration"}</span>
                  <span>{link.allowComments ? "Comments on" : "Comments off"}</span>
                  <span>{link.allowApproval ? "Approvals on" : "Approvals off"}</span>
                  <span className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          (repo) => repo.updateShareLink(link.id, { isActive: !link.isActive }),
                          shareLinkSaved,
                        )
                      }
                      className="font-medium text-ink-soft hover:text-ink"
                    >
                      {link.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const result = await run(
                          (repo) => repo.regenerateShareToken(link.id),
                          shareLinkSaved,
                        );
                        if (result.ok) toast("Token regenerated — old link no longer works");
                      }}
                      className="inline-flex items-center gap-1 font-medium text-ink-soft hover:text-ink"
                    >
                      <RotateCw className="size-3" aria-hidden="true" />
                      Regenerate
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border border-line bg-panel-raised p-3">
          <p className="text-[12.5px] font-medium text-ink">New link</p>
          <div className="mt-2 space-y-2">
            <TextField
              label="Expiration date (optional)"
              type="date"
              value={expiresDay}
              onChange={(e) => setExpiresDay(e.target.value)}
            />
            <ToggleField label="Allow comments" checked={allowComments} onChange={setAllowComments} />
            <ToggleField label="Allow approvals" checked={allowApproval} onChange={setAllowApproval} />
          </div>
          <Button variant="primary" className="mt-3" onClick={() => void createLink()} disabled={busy}>
            <Plus className="size-4" aria-hidden="true" />
            {busy ? "Creating…" : "Create share link"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
