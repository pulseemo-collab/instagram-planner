"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { MediaArt } from "@/components/instagram/media-art";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { UploadDropzone, type UploadedItem } from "@/components/uploads/upload-dropzone";
import { parseMediaRef } from "@/lib/instagram/map-profile";
import { useMutate } from "@/lib/store/hooks";
import type { Post } from "@/types/domain";

interface ContentMediaDraft {
  mediaType: "image" | "video";
  url: string;
  width: number | null;
  height: number | null;
  previewUrl?: string;
}

export interface AddContentDialogProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  /** For grid-position continuity. */
  existingCount: number;
}

/**
 * The designer's entire workflow: a name and the original media files.
 * Deliberately minimal — no captions, no scheduling, no metadata. The
 * scheduler turns this content into a real post later from the calendar.
 */
export function AddContentDialog(props: AddContentDialogProps) {
  if (!props.open) return null;
  return <AddContentDialogInner {...props} />;
}

function AddContentDialogInner({ onClose, clientId, existingCount }: AddContentDialogProps) {
  const mutate = useMutate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [media, setMedia] = useState<ContentMediaDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function addUploads(items: UploadedItem[]) {
    setMedia((current) => [
      ...current,
      ...items.map((item) => ({
        mediaType: item.mediaType,
        url: item.url,
        width: item.width,
        height: item.height,
        previewUrl: item.previewUrl,
      })),
    ]);
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Give the content a name (e.g. “Post 1”).");
      return;
    }
    if (media.length === 0) {
      setError("Upload at least one photo or video.");
      return;
    }
    const inferredType: Post["type"] =
      media.length > 1 ? "carousel" : media[0].mediaType === "video" ? "reel" : "image";

    setBusy(true);
    try {
      await mutate(async (repo) => {
        await repo.createPost(
          {
            clientId,
            name: name.trim(),
            stage: "content",
            type: inferredType,
            caption: "",
            location: null,
            altText: null,
            hashtags: [],
            status: "draft",
            approvalStatus: "not_sent",
            scheduledAt: null,
            publishedAt: null,
            isPinned: false,
            gridPosition: existingCount,
            likesCount: 0,
            commentsCount: 0,
          },
          media.map((m, index) => ({
            mediaType: m.mediaType,
            url: m.url,
            thumbnailUrl: null,
            width: m.width,
            height: m.height,
            position: index,
          })),
        );
        await repo.recordActivity({
          clientId,
          type: "post_created",
          description: `Content “${name.trim()}” uploaded`,
        });
      });
      toast("Content added");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add content");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add content"
      description="A name and the original files — the scheduler completes the post later."
    >
      <div className="space-y-4">
        <TextField
          label="Content name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Post 1"
        />

        <div className="space-y-2">
          <span className="block text-[12.5px] font-medium text-ink">Media</span>
          {media.length > 0 && (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {media.map((item, index) => {
                const ref = parseMediaRef(item.url);
                return (
                  <li
                    key={`${item.url}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-lg border border-line"
                  >
                    {item.mediaType === "video" && item.previewUrl ? (
                      <video
                        src={item.previewUrl}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      <MediaArt art={ref.art} imageUrl={item.previewUrl ?? ref.imageUrl} alt="" />
                    )}
                    <button
                      type="button"
                      aria-label={`Remove file ${index + 1}`}
                      onClick={() => setMedia((current) => current.filter((_, i) => i !== index))}
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded bg-black/55 text-white"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <UploadDropzone bucket="post-media" allowVideo multiple onUploaded={addUploads} />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-[12.5px] text-accent-deep">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy ? "Adding…" : "Add content"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
