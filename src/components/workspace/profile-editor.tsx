"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";
import { MediaArt } from "@/components/instagram/media-art";
import { parseMediaRef } from "@/lib/instagram/map-profile";
import { useMutate } from "@/lib/store/hooks";
import type { AccountType, Client, Theme } from "@/types/domain";

interface ProfileEditorProps {
  client: Client;
  /** Live-draft callback so edits render in the phone preview immediately. */
  onDraftChange: (draft: Client) => void;
}

/**
 * Edit panel for every profile field. Changes appear live in the preview via
 * `onDraftChange` and persist on Save. Mount with `key={client.id}` so a
 * client switch resets the draft.
 */
export function ProfileEditor({ client, onDraftChange }: ProfileEditorProps) {
  const mutate = useMutate();
  const { toast } = useToast();
  const [baseline, setBaseline] = useState<Client>(client);
  const [draft, setDraft] = useState<Client>(client);
  const [busy, setBusy] = useState(false);
  // True while a file is still uploading — saving waits for it.
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  function patch(partial: Partial<Client>) {
    setDraft((current) => {
      const next = { ...current, ...partial };
      onDraftChange(next);
      return next;
    });
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  async function save() {
    if (uploading) return;
    setBusy(true);
    setError(null);
    try {
      await mutate((repo) =>
        repo.updateClient(client.id, {
          instagramUsername: draft.instagramUsername,
          profileName: draft.profileName,
          avatarUrl: draft.avatarUrl,
          category: draft.category,
          bio: draft.bio,
          website: draft.website,
          threadsUsername: draft.threadsUsername,
          note: draft.note,
          isPrivate: draft.isPrivate,
          isVerified: draft.isVerified,
          accountType: draft.accountType,
          postsCount: draft.postsCount,
          followersCount: draft.followersCount,
          followingCount: draft.followingCount,
          theme: draft.theme,
        }),
      );
      setBaseline(draft);
      toast("Profile saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  const avatarRef = parseMediaRef(draft.avatarUrl);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="block text-[12.5px] font-medium text-ink">Profile picture</span>
        <div className="flex items-center gap-3">
          <span className="relative block size-14 shrink-0 overflow-hidden rounded-full border border-line">
            <MediaArt art={avatarRef.art} imageUrl={avatarPreviewUrl ?? avatarRef.imageUrl} alt="" />
          </span>
          <UploadDropzone
            bucket="avatars"
            multiple={false}
            label="Upload new picture"
            onBusyChange={setUploading}
            onUploaded={(items) => {
              if (items[0]) {
                patch({ avatarUrl: items[0].url });
                setAvatarPreviewUrl(items[0].previewUrl);
              }
            }}
            className="flex-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Username"
          value={draft.instagramUsername}
          onChange={(e) => patch({ instagramUsername: e.target.value })}
        />
        <TextField
          label="Profile name"
          value={draft.profileName}
          onChange={(e) => patch({ profileName: e.target.value })}
        />
      </div>

      <TextField
        label="Category"
        value={draft.category ?? ""}
        placeholder="Jewelry/Watches"
        onChange={(e) => patch({ category: e.target.value || null })}
      />

      <TextAreaField
        label="Bio"
        hint="One line per row, exactly as it appears on the profile."
        value={draft.bio}
        onChange={(e) => patch({ bio: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Website"
          value={draft.website ?? ""}
          placeholder="example.com"
          onChange={(e) => patch({ website: e.target.value || null })}
        />
        <TextField
          label="Threads username"
          value={draft.threadsUsername ?? ""}
          onChange={(e) => patch({ threadsUsername: e.target.value || null })}
        />
      </div>

      <TextField
        label="Profile note"
        hint="Short bubble above the avatar, like Instagram Notes."
        value={draft.note ?? ""}
        maxLength={60}
        onChange={(e) => patch({ note: e.target.value || null })}
      />

      <div className="grid grid-cols-3 gap-3">
        <TextField
          label="Posts"
          type="number"
          min={0}
          value={draft.postsCount}
          onChange={(e) => patch({ postsCount: Math.max(0, Number(e.target.value) || 0) })}
        />
        <TextField
          label="Followers"
          type="number"
          min={0}
          value={draft.followersCount}
          onChange={(e) => patch({ followersCount: Math.max(0, Number(e.target.value) || 0) })}
        />
        <TextField
          label="Following"
          type="number"
          min={0}
          value={draft.followingCount}
          onChange={(e) => patch({ followingCount: Math.max(0, Number(e.target.value) || 0) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Account type"
          value={draft.accountType}
          onChange={(e) => patch({ accountType: e.target.value as AccountType })}
        >
          <option value="business">Business</option>
          <option value="creator">Creator</option>
          <option value="personal">Personal</option>
        </SelectField>
        <SelectField
          label="Preview theme"
          value={draft.theme}
          onChange={(e) => patch({ theme: e.target.value as Theme })}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </SelectField>
      </div>

      <div className="space-y-1 border-t border-line pt-3">
        <ToggleField
          label="Verified badge"
          checked={draft.isVerified}
          onChange={(checked) => patch({ isVerified: checked })}
        />
        <ToggleField
          label="Private account"
          description="Shows the lock next to the username."
          checked={draft.isPrivate}
          onChange={(checked) => patch({ isPrivate: checked })}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-[12.5px] text-accent-deep">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-2 border-t border-line bg-panel px-1 pb-1 pt-3">
        <span className="text-[12px] text-ink-faint">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <Button variant="primary" onClick={() => void save()} disabled={busy || uploading || !dirty}>
          {busy ? "Saving…" : uploading ? "Uploading…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
