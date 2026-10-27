"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Copy, Ellipsis, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { ClientCard } from "@/components/clients/client-card";
import { ClientFormDialog, type ClientFormValues } from "@/components/clients/client-form-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { clientApprovalRollup, postsForClient } from "@/lib/derive";
import { useAction, useMutate, useWorkspace } from "@/lib/store/hooks";
import { APPROVAL_STATUS_LABELS, type ApprovalStatus, type Client } from "@/types/domain";

type ApprovalFilter = "all" | ApprovalStatus;
type SortKey = "updated" | "name";

function ClientMenu({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  /** Absent for team members: only the workspace owner deletes clients. */
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        aria-label="Client actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        className="flex size-8 items-center justify-center rounded-lg text-ink-faint hover:bg-canvas hover:text-ink"
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <span className="absolute right-0 top-9 z-20 block w-40 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-panel-hover">
          {[
            { label: "Edit details", icon: Pencil, action: onEdit },
            { label: "Duplicate", icon: Copy, action: onDuplicate },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                item.action();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-ink hover:bg-canvas"
            >
              <item.icon className="size-3.5 text-ink-faint" aria-hidden="true" />
              {item.label}
            </button>
          ))}
          {onDelete && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-red-700 hover:bg-canvas"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </button>
          )}
        </span>
      )}
    </span>
  );
}

function ClientsPageInner() {
  const { status, snapshot } = useWorkspace();
  const mutate = useMutate();
  const run = useAction();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [createOpen, setCreateOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!snapshot) return [];
    const q = query.trim().toLowerCase();
    let list = snapshot.clients.filter(
      (client) =>
        !q ||
        client.name.toLowerCase().includes(q) ||
        client.instagramUsername.toLowerCase().includes(q),
    );
    if (approvalFilter !== "all") {
      list = list.filter(
        (client) => clientApprovalRollup(postsForClient(snapshot, client.id)) === approvalFilter,
      );
    }
    return [...list].sort((a, b) =>
      sortKey === "name"
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [snapshot, query, approvalFilter, sortKey]);

  if (status === "loading" || status === "idle" || !snapshot) return <PageSkeleton />;

  async function handleCreate(values: ClientFormValues) {
    const client = await mutate(async (repo) => {
      const created = await repo.createClient({
        ...values,
        category: null,
        bio: "",
        website: null,
        threadsUsername: null,
        note: null,
        isPrivate: false,
        isVerified: false,
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
      });
      await repo.recordActivity({
        clientId: created.id,
        type: "client_created",
        description: `Client “${created.name}” created`,
      });
      return created;
    });
    toast(`${client.name} created`);
    router.push(`/clients/${client.id}`);
  }

  async function handleEdit(values: ClientFormValues) {
    if (!editing) return;
    await mutate((repo) => repo.updateClient(editing.id, values));
    toast("Client updated");
  }

  async function handleDuplicate(client: Client) {
    const copy = await run(async (repo) => {
      const created = await repo.duplicateClient(client.id);
      await repo.recordActivity({
        clientId: created.id,
        type: "client_created",
        description: `Client “${client.name}” duplicated`,
      });
      return created;
    });
    if (copy.ok) toast(`Duplicated as ${copy.value.name}`);
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    const result = await run((repo) => repo.deleteClient(deleting.id));
    setDeleteBusy(false);
    if (!result.ok) return;
    toast(`${deleting.name} deleted`);
    setDeleting(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            aria-label="Search clients"
            className="h-9 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
          />
        </div>
        <select
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value as ApprovalFilter)}
          aria-label="Filter by approval state"
          className="h-9 rounded-lg border border-line bg-panel px-3 text-[13px] text-ink focus:border-line-strong focus:outline-none"
        >
          <option value="all">All approval states</option>
          {(Object.keys(APPROVAL_STATUS_LABELS) as ApprovalStatus[]).map((key) => (
            <option key={key} value={key}>
              {APPROVAL_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sort clients"
          className="h-9 rounded-lg border border-line bg-panel px-3 text-[13px] text-ink focus:border-line-strong focus:outline-none"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name A–Z</option>
        </select>
        <Button variant="primary" onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="size-4" aria-hidden="true" />
          New client
        </Button>
      </div>

      {snapshot.clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Create your first client to start planning their Instagram grid."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New client
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="No clients match the current search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              posts={postsForClient(snapshot, client.id)}
              media={snapshot.media}
              menu={
                <ClientMenu
                  onEdit={() => setEditing(client)}
                  onDuplicate={() => void handleDuplicate(client)}
                  onDelete={snapshot.user.role === "owner" ? () => setDeleting(client) : undefined}
                />
              }
            />
          ))}
        </div>
      )}

      <ClientFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
      <ClientFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSubmit={handleEdit}
        client={editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title={`Delete ${deleting?.name ?? "client"}?`}
        body="This permanently removes the client with all posts, highlights, comments, and share links. This cannot be undone."
        confirmLabel="Delete client"
        destructive
        busy={deleteBusy}
      />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientsPageInner />
    </Suspense>
  );
}
