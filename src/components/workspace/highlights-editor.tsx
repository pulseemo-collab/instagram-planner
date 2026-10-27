"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { MediaArt } from "@/components/instagram/media-art";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";
import { parseMediaRef } from "@/lib/instagram/map-profile";
import { useAction, useMutate } from "@/lib/store/hooks";
import type { Highlight } from "@/types/domain";

interface HighlightsEditorProps {
  clientId: string;
  highlights: Highlight[];
}

interface HighlightDraft {
  id: string | null;
  title: string;
  coverUrl: string | null;
  /** Transient object URL for a just-uploaded cover. */
  coverPreviewUrl?: string | null;
}

export function HighlightsEditor({ clientId, highlights }: HighlightsEditorProps) {
  const mutate = useMutate();
  const run = useAction();
  const { toast } = useToast();
  const sorted = [...highlights].sort((a, b) => a.position - b.position);

  const [draft, setDraft] = useState<HighlightDraft | null>(null);
  const [deleting, setDeleting] = useState<Highlight | null>(null);
  const [busy, setBusy] = useState(false);
  // True while a file is still uploading — saving waits for it.
  const [uploading, setUploading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function saveDraft() {
    if (!draft || uploading) return;
    if (!draft.title.trim()) {
      setDraftError("Title is required");
      return;
    }
    setBusy(true);
    try {
      if (draft.id) {
        await mutate((repo) =>
          repo.updateHighlight(draft.id!, { title: draft.title.trim(), coverUrl: draft.coverUrl }),
        );
        toast("Highlight updated");
      } else {
        await mutate(async (repo) => {
          const created = await repo.createHighlight({
            clientId,
            title: draft.title.trim(),
            coverUrl: draft.coverUrl,
            position: sorted.length,
          });
          await repo.recordActivity({
            clientId,
            type: "highlight_created",
            description: `Highlight “${created.title}” added`,
          });
        });
        toast("Highlight added");
      }
      setDraft(null);
      setDraftError(null);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Could not save the highlight");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const ids = sorted.map((h) => h.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await run((repo) => repo.reorderHighlights(clientId, ids));
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await run((repo) => repo.deleteHighlight(deleting.id));
    setBusy(false);
    if (!result.ok) return;
    toast("Highlight deleted");
    setDeleting(null);
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No highlights"
          description="Add story highlights with covers — they appear instantly on the profile."
          action={
            <Button variant="primary" onClick={() => setDraft({ id: null, title: "", coverUrl: null })}>
              <Plus className="size-4" aria-hidden="true" />
              New highlight
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {sorted.map((highlight, index) => {
              const ref = parseMediaRef(highlight.coverUrl);
              return (
                <li
                  key={highlight.id}
                  className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2"
                >
                  <span className="relative block size-10 shrink-0 overflow-hidden rounded-full border border-line">
                    <MediaArt art={ref.art} imageUrl={ref.imageUrl} alt="" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                    {highlight.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move ${highlight.title} earlier`}
                      disabled={index === 0}
                      onClick={() => void move(index, -1)}
                      className="flex size-7 items-center justify-center rounded text-ink-soft hover:bg-canvas hover:text-ink disabled:opacity-30"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${highlight.title} later`}
                      disabled={index === sorted.length - 1}
                      onClick={() => void move(index, 1)}
                      className="flex size-7 items-center justify-center rounded text-ink-soft hover:bg-canvas hover:text-ink disabled:opacity-30"
                    >
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${highlight.title}`}
                      onClick={() =>
                        setDraft({ id: highlight.id, title: highlight.title, coverUrl: highlight.coverUrl })
                      }
                      className="flex size-7 items-center justify-center rounded text-ink-soft hover:bg-canvas hover:text-ink"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${highlight.title}`}
                      onClick={() => setDeleting(highlight)}
                      className="flex size-7 items-center justify-center rounded text-red-700 hover:bg-canvas"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <Button onClick={() => setDraft({ id: null, title: "", coverUrl: null })}>
            <Plus className="size-4" aria-hidden="true" />
            New highlight
          </Button>
        </>
      )}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit highlight" : "New highlight"}
      >
        {draft && (
          <div className="space-y-4">
            <TextField
              label="Title"
              value={draft.title}
              maxLength={30}
              error={draftError ?? undefined}
              onChange={(e) => {
                setDraft({ ...draft, title: e.target.value });
                setDraftError(null);
              }}
              placeholder="Héritage"
            />
            <div className="space-y-1.5">
              <span className="block text-[12.5px] font-medium text-ink">Cover</span>
              <div className="flex items-center gap-3">
                <span className="relative block size-14 shrink-0 overflow-hidden rounded-full border border-line">
                  {(() => {
                    const ref = parseMediaRef(draft.coverUrl);
                    return (
                      <MediaArt art={ref.art} imageUrl={draft.coverPreviewUrl ?? ref.imageUrl} alt="" />
                    );
                  })()}
                </span>
                <UploadDropzone
                  bucket="highlights"
                  multiple={false}
                  label="Upload cover"
                  onBusyChange={setUploading}
                  onUploaded={(items) =>
                    items[0] &&
                    setDraft({ ...draft, coverUrl: items[0].url, coverPreviewUrl: items[0].previewUrl })
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDraft(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void saveDraft()} disabled={busy || uploading}>
                {busy ? "Saving…" : uploading ? "Uploading…" : "Save highlight"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title={`Delete “${deleting?.title}”?`}
        body="The highlight is removed from the profile immediately."
        confirmLabel="Delete"
        destructive
        busy={busy}
      />
    </div>
  );
}
