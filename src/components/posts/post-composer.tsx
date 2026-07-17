"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { MediaArt } from "@/components/instagram/media-art";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { UploadDropzone, type UploadedItem } from "@/components/uploads/upload-dropzone";
import { isoFromLocalParts, localPartsFromIso } from "@/lib/dates";
import { parseMediaRef } from "@/lib/instagram/map-profile";
import { useMutate } from "@/lib/store/hooks";
import {
  MAX_PINNED_POSTS,
  type ApprovalStatus,
  type Post,
  type PostMedia,
  type PostType,
} from "@/types/domain";

interface MediaDraft {
  id?: string;
  mediaType: "image" | "video";
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  /** Transient object URL for a just-uploaded file (not persisted). */
  previewUrl?: string;
}

export interface PostComposerProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  /** Editing an existing post when provided. */
  post?: Post | null;
  existingMedia?: PostMedia[];
  /** Used for grid position + pinned-count validation. */
  clientPosts: Post[];
  /** Pre-uploaded media to start a new post from (bulk creation). */
  initialMedia?: MediaDraft[];
}

function hashtagsToText(tags: string[]): string {
  return tags.map((t) => `#${t}`).join(" ");
}

function textToHashtags(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function PostComposer(props: PostComposerProps) {
  // Mounts fresh whenever the dialog opens, so field state is seeded by
  // useState initializers instead of effects.
  if (!props.open) return null;
  return <PostComposerInner {...props} />;
}

function PostComposerInner({
  onClose,
  clientId,
  post,
  existingMedia,
  clientPosts,
  initialMedia,
}: PostComposerProps) {
  const mutate = useMutate();
  const { toast } = useToast();

  const startingMedia = useMemo<MediaDraft[]>(() => {
    if (post) {
      return (existingMedia ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((m) => ({
          id: m.id,
          mediaType: m.mediaType,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl,
          width: m.width,
          height: m.height,
        }));
    }
    return initialMedia ?? [];
  }, [post, existingMedia, initialMedia]);

  const scheduledParts = post?.scheduledAt ? localPartsFromIso(post.scheduledAt) : null;

  const [type, setType] = useState<PostType>(() => {
    if (post) return post.type;
    if (startingMedia.length > 1) return "carousel";
    if (startingMedia[0]?.mediaType === "video") return "reel";
    return "image";
  });
  const [media, setMedia] = useState<MediaDraft[]>(startingMedia);
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [hashtagsText, setHashtagsText] = useState(post ? hashtagsToText(post.hashtags) : "");
  const [location, setLocation] = useState(post?.location ?? "");
  const [altText, setAltText] = useState(post?.altText ?? "");
  const [isPinned, setIsPinned] = useState(post?.isPinned ?? false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(
    post?.approvalStatus ?? "not_sent",
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(Boolean(scheduledParts));
  const [scheduleDay, setScheduleDay] = useState(scheduledParts?.day ?? "");
  const [scheduleTime, setScheduleTime] = useState(scheduledParts?.time ?? "18:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  const pinnedCount = useMemo(
    () => clientPosts.filter((p) => p.isPinned && p.id !== post?.id).length,
    [clientPosts, post],
  );

  function addUploads(items: UploadedItem[]) {
    setMedia((current) => {
      const next = [
        ...current,
        ...items.map((item) => ({
          mediaType: item.mediaType,
          url: item.url,
          thumbnailUrl: null,
          width: item.width,
          height: item.height,
          previewUrl: item.previewUrl,
        })),
      ];
      // Sensible type inference as media changes.
      if (next.length > 1 && type === "image") setType("carousel");
      if (next.length === 1 && next[0].mediaType === "video") setType("reel");
      return next;
    });
  }

  function moveMedia(index: number, delta: number) {
    setMedia((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setError(null);
    if (media.length === 0) {
      setError("Add at least one media file.");
      return;
    }
    if (type === "carousel" && media.length < 2) {
      setError("A carousel needs at least two slides.");
      return;
    }
    if (type !== "carousel" && media.length > 1) {
      setError("Only carousels can contain multiple media items — remove extras or switch type.");
      return;
    }
    if (type === "reel" && media[0].mediaType !== "video" && !media[0].url) {
      setError("A reel needs a video or a cover image.");
      return;
    }
    if (isPinned && pinnedCount >= MAX_PINNED_POSTS) {
      setError(`Instagram allows up to ${MAX_PINNED_POSTS} pinned posts.`);
      return;
    }
    if (scheduleEnabled && !scheduleDay) {
      setError("Pick a date for the scheduled post.");
      return;
    }

    const scheduledAt = scheduleEnabled ? isoFromLocalParts(scheduleDay, scheduleTime) : null;
    // Persist only durable fields — previewUrl is a transient object URL.
    const persistedMedia = media.map((m, index) => ({
      id: m.id,
      mediaType: m.mediaType,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      width: m.width,
      height: m.height,
      position: index,
    }));
    const base = {
      type,
      caption,
      location: location.trim() || null,
      altText: altText.trim() || null,
      hashtags: textToHashtags(hashtagsText),
      status: (scheduleEnabled ? "scheduled" : (post?.status === "published" ? "published" : "draft")) as Post["status"],
      approvalStatus,
      scheduledAt,
      isPinned,
    };

    setBusy(true);
    try {
      if (post) {
        await mutate(async (repo) => {
          await repo.updatePost(post.id, base);
          await repo.setPostMedia(post.id, persistedMedia);
          if (scheduleEnabled && post.scheduledAt !== scheduledAt) {
            await repo.recordActivity({
              clientId,
              type: "post_scheduled",
              description: "Post rescheduled",
            });
          }
        });
        toast("Post updated");
      } else {
        await mutate(async (repo) => {
          await repo.createPost(
            {
              ...base,
              clientId,
              publishedAt: null,
              gridPosition: clientPosts.length,
              likesCount: 0,
              commentsCount: 0,
            },
            persistedMedia,
          );
          await repo.recordActivity({
            clientId,
            type: scheduleEnabled ? "post_scheduled" : "post_created",
            description: scheduleEnabled ? "New post scheduled" : "New post created",
          });
        });
        toast("Post created");
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save post");
    } finally {
      setBusy(false);
    }
  }

  const isReel = type === "reel";
  const coverRef = isReel && media[0] ? parseMediaRef(media[0].thumbnailUrl ?? media[0].url) : null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={post ? "Edit post" : "New post"}
      description={post ? undefined : "Media first — captions and scheduling below."}
      size="lg"
    >
      <div className="space-y-4">
        <SelectField
          label="Post type"
          value={type}
          onChange={(e) => setType(e.target.value as PostType)}
        >
          <option value="image">Single image</option>
          <option value="carousel">Carousel</option>
          <option value="reel">Reel</option>
        </SelectField>

        {/* Media manager */}
        <div className="space-y-2">
          <span className="block text-[12.5px] font-medium text-ink">
            Media {type === "carousel" && `(${media.length} slides)`}
          </span>
          {media.length > 0 && (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {media.map((item, index) => {
                const ref = parseMediaRef(item.thumbnailUrl ?? item.url);
                const displayUrl = item.previewUrl ?? ref.imageUrl;
                const videoSrc =
                  item.mediaType === "video"
                    ? (item.previewUrl ?? (item.url.startsWith("gradient:") ? null : item.url))
                    : null;
                return (
                  <li key={`${item.url}-${index}`} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-line">
                    {videoSrc ? (
                      <video src={videoSrc} className="absolute inset-0 h-full w-full object-cover" muted />
                    ) : (
                      <MediaArt art={ref.art} imageUrl={displayUrl} alt="" />
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/55 px-1 text-[10px] font-medium text-white">
                      {index + 1}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-gradient-to-t from-black/55 to-transparent p-1">
                      <button
                        type="button"
                        aria-label={`Move slide ${index + 1} left`}
                        disabled={index === 0}
                        onClick={() => moveMedia(index, -1)}
                        className="flex size-6 items-center justify-center rounded bg-black/40 text-white disabled:opacity-30"
                      >
                        <ArrowLeft className="size-3" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move slide ${index + 1} right`}
                        disabled={index === media.length - 1}
                        onClick={() => moveMedia(index, 1)}
                        className="flex size-6 items-center justify-center rounded bg-black/40 text-white disabled:opacity-30"
                      >
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove slide ${index + 1}`}
                        onClick={() => setMedia((current) => current.filter((_, i) => i !== index))}
                        className="flex size-6 items-center justify-center rounded bg-black/40 text-white"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <UploadDropzone
            bucket="post-media"
            allowVideo={type === "reel"}
            multiple={type === "carousel"}
            onUploaded={addUploads}
          />
        </div>

        {isReel && (
          <div className="space-y-1.5">
            <span className="block text-[12.5px] font-medium text-ink">Reel cover</span>
            <div className="flex items-center gap-3">
              {coverRef && (
                <span className="relative block h-16 w-10 shrink-0 overflow-hidden rounded border border-line">
                  <MediaArt art={coverRef.art} imageUrl={coverPreviewUrl ?? coverRef.imageUrl} alt="" />
                </span>
              )}
              <UploadDropzone
                bucket="post-media"
                multiple={false}
                label="Upload cover image"
                onUploaded={(items) => {
                  const item = items[0];
                  if (item) {
                    setCoverPreviewUrl(item.previewUrl);
                    setMedia((current) =>
                      current.length
                        ? [{ ...current[0], thumbnailUrl: item.url }, ...current.slice(1)]
                        : [{ mediaType: "image", url: item.url, thumbnailUrl: item.url, width: item.width, height: item.height }],
                    );
                  }
                }}
                className="flex-1"
              />
            </div>
          </div>
        )}

        <TextAreaField label="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <TextField
          label="Hashtags"
          hint="Space-separated; # optional."
          value={hashtagsText}
          onChange={(e) => setHashtagsText(e.target.value)}
          placeholder="#finejewelry #atelier"
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <TextField label="Alt text" value={altText} onChange={(e) => setAltText(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Approval status"
            value={approvalStatus}
            onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}
          >
            <option value="not_sent">Not sent</option>
            <option value="awaiting_approval">Awaiting approval</option>
            <option value="approved">Approved</option>
            <option value="changes_requested">Changes requested</option>
          </SelectField>
          <div className="pt-1">
            <ToggleField
              label="Pin to profile"
              description={`Max ${MAX_PINNED_POSTS} pinned posts.`}
              checked={isPinned}
              onChange={setIsPinned}
              disabled={!isPinned && pinnedCount >= MAX_PINNED_POSTS}
            />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel-raised p-3">
          <ToggleField
            label="Schedule"
            description="Set the planned publish date and time."
            checked={scheduleEnabled}
            onChange={setScheduleEnabled}
          />
          {scheduleEnabled && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <TextField
                label="Date"
                type="date"
                value={scheduleDay}
                onChange={(e) => setScheduleDay(e.target.value)}
              />
              <TextField
                label="Time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          )}
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
            {busy ? "Saving…" : post ? "Save post" : "Create post"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
