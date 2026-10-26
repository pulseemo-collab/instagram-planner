import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

/*
 * Helpers for live-mode tests against the LOCAL Supabase stack only
 * (playwright.live.config.ts refuses anything else). The service-role
 * client is the local stack's admin key, used for test setup and for
 * assertions the app's own users can't make (e.g. listing Storage files).
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAIL_URL = process.env.SUPABASE_MAIL_URL ?? "http://127.0.0.1:54324";

export const PASSWORD = "live-test-password-1";

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, noSession);
}

/** A plain anonymous client — what a public reviewer's browser could call. */
export function anon(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, noSession);
}

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}

/** A confirmed user created through the admin API (skips the email step). */
export async function createUser(label: string, displayName = "Live Tester") {
  const email = uniqueEmail(label);
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  return { id: data.user.id, email, displayName };
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Welcome back,/ })).toBeVisible({ timeout: 30_000 });
}

/** Insert rows with the admin client; throws on any error. */
type Row = Record<string, unknown>;

export async function insert(table: string, row: Row | Row[]) {
  // Untyped client (no generated DB types), so rows are passed through as-is.
  const { data, error } = await admin().from(table).insert(row as never).select();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data as Array<Record<string, unknown>>;
}

/** A client (and optionally completed posts) owned by `ownerId`. */
export async function seedClient(ownerId: string, name: string, postNames: string[] = []) {
  const [client] = await insert("clients", {
    owner_id: ownerId,
    name,
    slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    instagram_username: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50),
  });
  const posts = postNames.length
    ? await insert(
        "posts",
        postNames.map((postName, index) => ({
          client_id: client.id,
          name: postName,
          stage: "post",
          approval_status: "awaiting_approval",
          grid_position: index,
        })),
      )
    : [];
  return { clientId: String(client.id), postIds: posts.map((p) => String(p.id)) };
}

export async function seedShareLink(clientId: string, flags: { allowComments?: boolean; allowApproval?: boolean } = {}) {
  const token = `live${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  const [link] = await insert("share_links", {
    client_id: clientId,
    token,
    allow_comments: flags.allowComments ?? true,
    allow_approval: flags.allowApproval ?? true,
  });
  return { token, linkId: String(link.id) };
}

/** Every Storage object under `<userId>/` in a bucket (recursive). */
export async function listUserFiles(bucket: string, userId: string): Promise<string[]> {
  const storage = admin().storage.from(bucket);
  const out: string[] = [];
  async function walk(prefix: string) {
    const { data, error } = await storage.list(prefix, { limit: 1000 });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) await walk(path); // a "folder"
      else out.push(path);
    }
  }
  await walk(userId);
  return out;
}

/**
 * The newest email to `address` from the local mail catcher. Supports the
 * Mailpit API (current Supabase CLI) and the older Inbucket API.
 */
export async function latestEmailText(address: string): Promise<string> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const search = await fetch(`${MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
      if (search.ok) {
        const { messages } = (await search.json()) as { messages?: Array<{ ID: string }> };
        if (messages?.length) {
          const message = await fetch(`${MAIL_URL}/api/v1/message/${messages[0].ID}`);
          const body = (await message.json()) as { Text?: string; HTML?: string };
          return body.Text || body.HTML || "";
        }
      } else {
        const mailbox = address.split("@")[0];
        const list = await fetch(`${MAIL_URL}/api/v1/mailbox/${mailbox}`);
        if (list.ok) {
          const items = (await list.json()) as Array<{ id: string }>;
          if (items.length) {
            const message = await fetch(`${MAIL_URL}/api/v1/mailbox/${mailbox}/${items[items.length - 1].id}`);
            const body = (await message.json()) as { body?: { text?: string; html?: string } };
            return body.body?.text || body.body?.html || "";
          }
        }
      }
    } catch {
      // mail catcher not ready yet — retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No email for ${address} within 30 s`);
}
