"use client";

import { Dialog } from "@/components/ui/dialog";
import { PostForm, type MediaDraft } from "./post-form";
import type { Post, PostMedia } from "@/types/domain";

export interface PostComposerProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  /** Editing an existing post when provided. */
  post?: Post | null;
  existingMedia?: PostMedia[];
  /** Used for grid position + pinned-count validation. */
  clientPosts: Post[];
  /** Pre-uploaded media to start a new post from. */
  initialMedia?: MediaDraft[];
}

/**
 * Dialog wrapper around the shared PostForm. Mounts fresh whenever the dialog
 * opens, so field state is seeded by useState initializers instead of effects.
 */
export function PostComposer(props: PostComposerProps) {
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
  return (
    <Dialog
      open
      onClose={onClose}
      title={post ? "Edit post" : "New post"}
      description={post ? undefined : "Name it, drop the media — everything else can wait."}
      size="lg"
    >
      <PostForm
        clientId={clientId}
        post={post}
        existingMedia={existingMedia}
        clientPosts={clientPosts}
        initialMedia={initialMedia}
        variant="dialog"
        onSaved={onClose}
        onCancel={onClose}
      />
    </Dialog>
  );
}
