"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/field";
import { UploadDropzone, type UploadedItem } from "@/components/uploads/upload-dropzone";
import { parseMediaRef } from "@/lib/instagram/map-profile";
import { MediaArt } from "@/components/instagram/media-art";
import type { AccountType, Client, Theme } from "@/types/domain";

export interface ClientFormValues {
  name: string;
  instagramUsername: string;
  profileName: string;
  avatarUrl: string | null;
  accountType: AccountType;
  theme: Theme;
}

interface ClientFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  /** When present, edits an existing client instead of creating one. */
  client?: Client | null;
}

function validate(values: ClientFormValues): Partial<Record<keyof ClientFormValues, string>> {
  const errors: Partial<Record<keyof ClientFormValues, string>> = {};
  if (!values.name.trim()) errors.name = "Client name is required";
  const username = values.instagramUsername.trim();
  if (!username) errors.instagramUsername = "Instagram username is required";
  else if (!/^[a-z0-9._]{1,30}$/i.test(username))
    errors.instagramUsername = "Letters, numbers, dots and underscores only (max 30)";
  return errors;
}

export function ClientFormDialog({ open, onClose, onSubmit, client }: ClientFormDialogProps) {
  // The form mounts fresh every time the dialog opens, so state initializers
  // (not effects) seed the fields from the client being edited.
  if (!open) return null;
  return <ClientFormDialogInner onClose={onClose} onSubmit={onSubmit} client={client} />;
}

function ClientFormDialogInner({ onClose, onSubmit, client }: Omit<ClientFormDialogProps, "open">) {
  const [values, setValues] = useState<ClientFormValues>(() => ({
    name: client?.name ?? "",
    instagramUsername: client?.instagramUsername ?? "",
    profileName: client?.profileName ?? "",
    avatarUrl: client?.avatarUrl ?? null,
    accountType: client?.accountType ?? "business",
    theme: client?.theme ?? "light",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormValues, string>>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Object URL for a just-uploaded avatar; the stored `local:` reference is
  // resolved by the workspace store only after saving.
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        instagramUsername: values.instagramUsername.trim().toLowerCase(),
        profileName: values.profileName.trim() || values.name.trim(),
      });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save client");
    } finally {
      setBusy(false);
    }
  }

  const avatarRef = parseMediaRef(values.avatarUrl);

  return (
    <Dialog
      open
      onClose={onClose}
      title={client ? "Edit client" : "New client"}
      description={client ? undefined : "Set up the Instagram profile you'll be planning for."}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="Client / business name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={errors.name}
          placeholder="Maison Aurelle"
        />
        <TextField
          label="Instagram username"
          value={values.instagramUsername}
          onChange={(e) => setValues((v) => ({ ...v, instagramUsername: e.target.value }))}
          error={errors.instagramUsername}
          placeholder="maisonaurelle"
        />
        <TextField
          label="Profile name"
          hint="Shown bold on the profile — defaults to the client name."
          value={values.profileName}
          onChange={(e) => setValues((v) => ({ ...v, profileName: e.target.value }))}
        />

        <div className="space-y-1.5">
          <span className="block text-[12.5px] font-medium text-ink">Profile picture</span>
          <div className="flex items-center gap-3">
            <span className="relative block size-12 shrink-0 overflow-hidden rounded-full border border-line">
              <MediaArt art={avatarRef.art} imageUrl={avatarPreviewUrl ?? avatarRef.imageUrl} alt="" />
            </span>
            <UploadDropzone
              bucket="avatars"
              multiple={false}
              label="Upload profile picture"
              onUploaded={(items: UploadedItem[]) => {
                const item = items[0];
                if (item) {
                  setValues((v) => ({ ...v, avatarUrl: item.url }));
                  setAvatarPreviewUrl(item.previewUrl);
                }
              }}
              className="flex-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Account type"
            value={values.accountType}
            onChange={(e) => setValues((v) => ({ ...v, accountType: e.target.value as AccountType }))}
          >
            <option value="business">Business</option>
            <option value="creator">Creator</option>
            <option value="personal">Personal</option>
          </SelectField>
          <SelectField
            label="Preview theme"
            value={values.theme}
            onChange={(e) => setValues((v) => ({ ...v, theme: e.target.value as Theme }))}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectField>
        </div>

        {formError && (
          <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-[12.5px] text-accent-deep">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : client ? "Save changes" : "Create client"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
