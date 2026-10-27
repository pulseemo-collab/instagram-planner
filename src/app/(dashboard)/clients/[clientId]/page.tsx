"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Ellipsis,
  Eye,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { InstagramProfile } from "@/components/instagram/instagram-profile";
import { PhoneFrame } from "@/components/preview/phone-frame";
import { PostComposer } from "@/components/posts/post-composer";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { HighlightsEditor } from "@/components/workspace/highlights-editor";
import { ProfileEditor } from "@/components/workspace/profile-editor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { buildIgProfile, sortForGrid } from "@/lib/instagram/map-profile";
import { useAction, useWorkspace } from "@/lib/store/hooks";
import type { Client } from "@/types/domain";

type PanelTab = "profile" | "highlights" | "posts";
type Mode = "edit" | "preview";

export default function ClientWorkspacePage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const { status, snapshot } = useWorkspace();
  const run = useAction();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("edit");
  const [panelTab, setPanelTab] = useState<PanelTab>("profile");
  const [draftClient, setDraftClient] = useState<Client | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const client = snapshot?.clients.find((c) => c.id === params.clientId) ?? null;

  const bundle = useMemo(() => {
    if (!snapshot || !client) return null;
    const posts = snapshot.posts.filter((p) => p.clientId === client.id);
    const postIds = new Set(posts.map((p) => p.id));
    return {
      highlights: snapshot.highlights.filter((h) => h.clientId === client.id),
      posts,
      media: snapshot.media.filter((m) => postIds.has(m.postId)),
    };
  }, [snapshot, client]);

  const effectiveClient = draftClient && client && draftClient.id === client.id && mode === "edit"
    ? draftClient
    : client;

  const igProfile = useMemo(() => {
    if (!effectiveClient || !bundle) return null;
    return buildIgProfile(effectiveClient, bundle.highlights, bundle.posts, bundle.media);
  }, [effectiveClient, bundle]);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  if (!client || !bundle || !igProfile) {
    return (
      <EmptyState
        icon={UserRound}
        title="Client not found"
        description="This client may have been deleted."
        action={
          <Button variant="primary" onClick={() => router.push("/clients")}>
            Back to clients
          </Button>
        }
      />
    );
  }

  async function handleReorder(orderedIds: string[]) {
    await run((repo) => repo.reorderPosts(client!.id, orderedIds));
  }

  async function handleDelete() {
    setDeleteBusy(true);
    const result = await run((repo) => repo.deleteClient(client!.id));
    setDeleteBusy(false);
    if (!result.ok) return;
    toast(`${client!.name} deleted`);
    router.push("/clients");
  }

  const orderedPosts = sortForGrid(bundle.posts);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/clients"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-soft hover:bg-panel hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Clients
        </Link>
        <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-ink">
          {client.name}
        </h2>
        <span className="text-[12px] text-ink-faint">@{client.instagramUsername}</span>

        <div className="ml-auto flex items-center gap-2">
          <div role="radiogroup" aria-label="Workspace mode" className="flex rounded-lg border border-line bg-panel p-0.5">
            {(["edit", "preview"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors",
                  mode === m ? "bg-ink text-panel" : "text-ink-soft hover:text-ink",
                )}
              >
                {m === "edit" ? (
                  <Pencil className="size-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="size-3.5" aria-hidden="true" />
                )}
                {m}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" aria-hidden="true" />
            Share
          </Button>
          <span className="relative">
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={(e) => {
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setMenuOpen(false);
              }}
              className="flex size-9 items-center justify-center rounded-lg border border-line bg-panel text-ink-soft hover:text-ink"
            >
              <Ellipsis className="size-4" aria-hidden="true" />
            </button>
            {menuOpen && (
              <span className="absolute right-0 top-10 z-20 block w-44 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-panel-hover">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={async () => {
                    setMenuOpen(false);
                    const copy = await run((repo) => repo.duplicateClient(client.id));
                    if (!copy.ok) return;
                    toast(`Duplicated as ${copy.value.name}`);
                    router.push(`/clients/${copy.value.id}`);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-ink hover:bg-canvas"
                >
                  Duplicate client
                </button>
                {snapshot.user.role === "owner" && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-red-700 hover:bg-canvas"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete client
                  </button>
                )}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Workspace body */}
      <div
        className={cn(
          "grid gap-6",
          mode === "edit" ? "lg:grid-cols-[minmax(0,1fr)_420px]" : "justify-center",
        )}
      >
        <div className="flex min-w-0 justify-center lg:sticky lg:top-24 lg:self-start">
          <PhoneFrame theme={client.theme}>
            <InstagramProfile
              profile={igProfile}
              theme={client.theme}
              onPostOpen={(postId) => router.push(`/clients/${client.id}/posts/${postId}`)}
              gridEditing={mode === "edit" ? { onReorder: handleReorder } : undefined}
            />
          </PhoneFrame>
        </div>

        {mode === "edit" && (
          <div className="min-w-0 rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
            <div role="tablist" aria-label="Editing panels" className="mb-4 flex gap-1 border-b border-line">
              {(
                [
                  { id: "profile", label: "Profile", icon: UserRound },
                  { id: "highlights", label: "Highlights", icon: Sparkles },
                  { id: "posts", label: "Posts", icon: Plus },
                ] as Array<{ id: PanelTab; label: string; icon: typeof UserRound }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={panelTab === tab.id}
                  onClick={() => setPanelTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
                    panelTab === tab.id
                      ? "border-ink text-ink"
                      : "border-transparent text-ink-soft hover:text-ink",
                  )}
                >
                  <tab.icon className="size-3.5" aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </div>

            {panelTab === "profile" && (
              <ProfileEditor key={client.id} client={client} onDraftChange={setDraftClient} />
            )}
            {panelTab === "highlights" && (
              <HighlightsEditor clientId={client.id} highlights={bundle.highlights} />
            )}
            {panelTab === "posts" && (
              <div className="space-y-3">
                <p className="text-[12.5px] leading-relaxed text-ink-soft">
                  Click any grid tile to open its post. Drag tiles (or focus one and press
                  Ctrl+Arrow keys) to reorder the grid. Pinned posts stay first, like on
                  Instagram.
                </p>
                <Button variant="primary" onClick={() => setComposerOpen(true)}>
                  <Plus className="size-4" aria-hidden="true" />
                  New post
                </Button>
                <p className="text-[12px] text-ink-faint">
                  {bundle.posts.length} {bundle.posts.length === 1 ? "post" : "posts"} ·{" "}
                  {orderedPosts.filter((p) => p.isPinned).length} pinned
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        clientId={client.id}
        clientPosts={bundle.posts}
      />
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        clientId={client.id}
        clientName={client.name}
        shareLinks={snapshot.shareLinks}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title={`Delete ${client.name}?`}
        body="This permanently removes the client and everything inside it."
        confirmLabel="Delete client"
        destructive
        busy={deleteBusy}
      />
    </div>
  );
}
