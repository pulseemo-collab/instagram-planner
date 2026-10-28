import { expect, test, type Page } from "@playwright/test";
import { panelTab, paths } from "../e2e/helpers";
import {
  PASSWORD,
  admin,
  anon,
  createUser,
  ensureOwner,
  insert,
  latestEmailText,
  listUserFiles,
  seedClient,
  seedShareLink,
  signIn,
  signedInClient,
  uniqueEmail,
} from "./helpers";

/*
 * Live mode end to end: the real SupabaseRepository, RLS, the 0006–0011
 * RPCs and triggers, Storage and Auth — against the LOCAL stack started by
 * `supabase start` in CI. Each test creates its own users and data; since
 * 0010 every approved user shares ONE team workspace, so assertions look
 * for each test's own unique names instead of counting everything.
 */

const suffix = () => Math.random().toString(36).slice(2, 7);

async function signUpAndConfirm(page: Page, name: string, email: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page.locator("body")).toContainText(email);

  const mail = await latestEmailText(email);
  const link = mail.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/)?.[0];
  expect(link, "confirmation link in the email").toBeTruthy();
  await page.goto(link!.replace(/&amp;/g, "&"));
}

test.describe("Auth + owner approval (migration 0010)", () => {
  test("signup → confirm → waiting screen → owner approves → workspace opens", async ({ page, browser }) => {
    const email = uniqueEmail("signup");
    const name = `New ${suffix()}`;
    await signUpAndConfirm(page, name, email);
    await signIn(page, email, { pending: true });
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);

    // The owner sees the sign-up (confirmed email, so notified) and approves it.
    const owner = await ensureOwner();
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, owner.email);
    await ownerPage.goto("/team");
    await ownerPage.getByRole("button", { name: `Approve ${name}` }).click();
    await ownerPage.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
    await expect(ownerPage.locator("body")).toContainText(`${name} can now use the workspace`);
    await ownerContext.close();

    await page.getByRole("button", { name: "Check again" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back, New" })).toBeVisible({ timeout: 30_000 });
    // Members have no Team page.
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "Clients" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Team" })).toHaveCount(0);
    // Live builds have no demo entry.
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue in demo mode" })).toHaveCount(0);
  });

  test("reject deletes the account completely; the same email can sign up again", async ({ page }) => {
    const name = `Reject ${suffix()}`;
    const pending = await createUser("reject", name, { approved: false });
    const notice = await admin().from("notifications").select("id").eq("subject_user_id", pending.id);
    expect(notice.data).toHaveLength(1);

    const owner = await ensureOwner();
    await signIn(page, owner.email);
    await page.goto("/team");
    await page.getByRole("button", { name: `Reject ${name}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reject and delete account" }).click();
    await expect(page.locator("body")).toContainText(`${name}'s account was deleted`);

    const authUser = await admin().auth.admin.getUserById(pending.id);
    expect(authUser.data.user).toBeNull();
    const profile = await admin().from("profiles").select("id").eq("id", pending.id);
    expect(profile.data).toEqual([]);
    const gone = await admin().from("notifications").select("id").eq("subject_user_id", pending.id);
    expect(gone.data).toEqual([]);

    // Signed out, the same address can register from scratch.
    await page.context().clearCookies();
    await page.goto("/signup");
    await page.getByLabel("Your name").fill(name);
    await page.getByLabel("Email").fill(pending.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  });

  test("a pending account sees nothing and can't promote itself through the API", async () => {
    const owner = await ensureOwner();
    await seedClient(owner.id, `Hidden ${suffix()}`, ["Secret post"]);
    const pending = await createUser("pending-api", "Pending Person", { approved: false });
    const sb = await signedInClient(pending.email);

    for (const table of ["clients", "posts", "notifications", "share_links"]) {
      const { data } = await sb.from(table).select("id");
      expect(data ?? [], `${table} is hidden`).toEqual([]);
    }
    // Over PostgREST, exactly as a browser could send it.
    const promote = await sb.from("profiles").update({ status: "approved" } as never).eq("id", pending.id).select();
    expect(promote.error).not.toBeNull();
    const crown = await sb.from("profiles").update({ role: "owner" } as never).eq("id", pending.id).select();
    expect(crown.error).not.toBeNull();
    const approveSelf = await sb.rpc("approve_member", { p_user_id: pending.id });
    expect(approveSelf.error?.message).toBe("not_owner");
    const upload = await sb.storage
      .from("post-media")
      .upload(`${pending.id}/x/sneaky.png`, new Blob([new Uint8Array([1])], { type: "image/png" }));
    expect(upload.error).not.toBeNull();

    const { data: still } = await admin().from("profiles").select("role, status").eq("id", pending.id).single();
    expect(still).toEqual({ role: "member", status: "pending" });
    // Renaming yourself is still allowed.
    const rename = await sb.from("profiles").update({ display_name: "Renamed" } as never).eq("id", pending.id);
    expect(rename.error).toBeNull();
  });

  test("a member works on a teammate's client but can't delete it", async ({ page }) => {
    const owner = await ensureOwner();
    const clientName = `Shared ${suffix()}`;
    const { clientId } = await seedClient(owner.id, clientName, ["Team post"]);
    const member = await createUser("member", "Mia Member");
    await signIn(page, member.email);

    await page.goto(`/clients/${clientId}`);
    await page.getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("button", { name: "Duplicate client" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete client" })).toHaveCount(0);

    const sb = await signedInClient(member.email);
    const edit = await sb.from("clients").update({ bio: "Edited by a member" } as never).eq("id", clientId).select("id");
    expect(edit.data).toHaveLength(1);
    const del = await sb.from("clients").delete().eq("id", clientId).select("id");
    expect(del.data ?? []).toEqual([]);
    const { data: kept } = await admin().from("clients").select("id").eq("id", clientId);
    expect(kept).toHaveLength(1);
  });
});

test.describe("Owner workflow + Storage cleanup", () => {
  test("uploads land in the owner's folder; deleting removes files only when unreferenced", async ({ page }) => {
    const owner = await createUser("storage");
    const { clientId } = await seedClient(owner.id, "Storage Client");
    await signIn(page, owner.email);

    // Create a post with a photo through the UI (Storage upload + set_post_media path).
    await page.goto(`/clients/${clientId}`);
    await panelTab(page, "Posts").click();
    await page.getByRole("button", { name: "New post" }).click();
    const dialog = page.getByRole("dialog", { name: "New post" });
    await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("photo-1.png"));
    // Upload finished: the file is a slide in the post, and saving is enabled.
    await expect(dialog.getByRole("button", { name: "Remove slide 1" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create post" })).toBeEnabled();
    await dialog.getByLabel("Post name").fill("Live photo");
    await dialog.getByRole("button", { name: "Create post" }).click();
    await expect(page.locator("body")).toContainText("Post created");

    const files = await listUserFiles("post-media", owner.id);
    expect(files).toHaveLength(1);
    expect(files[0].startsWith(`${owner.id}/`)).toBe(true);

    // Duplicate the client (duplicate_client RPC): the copy shares the file.
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Duplicate client" }).click();
    await expect(page.locator("body")).toContainText("Duplicated as Storage Client copy");
    const copyId = page.url().match(/\/clients\/([0-9a-f-]{36})/)![1];
    expect(copyId).not.toBe(clientId);

    const postIdOf = async (cid: string) => {
      const { data } = await admin().from("posts").select("id").eq("client_id", cid).eq("name", "Live photo");
      return String(data![0].id);
    };
    const originalPost = await postIdOf(clientId);
    const copiedPost = await postIdOf(copyId);

    // Deleting the original post keeps the file: the copy still uses it.
    await page.goto(`/clients/${clientId}/posts/${originalPost}`);
    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete post" }).click();
    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}$`));
    expect(await listUserFiles("post-media", owner.id)).toEqual(files);

    // Deleting the last reference removes exactly that file.
    await page.goto(`/clients/${copyId}/posts/${copiedPost}`);
    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete post" }).click();
    await expect.poll(() => listUserFiles("post-media", owner.id)).toEqual([]);
  });

  test("a teammate's unreferenced file is cleaned up by another member's delete", async ({ page }) => {
    const uploader = await createUser("uploader");
    const filePath = `${uploader.id}/team/shared.png`;
    const upload = await admin()
      .storage.from("post-media")
      .upload(filePath, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    expect(upload.error).toBeNull();
    const publicUrl = admin().storage.from("post-media").getPublicUrl(filePath).data.publicUrl;

    const deleter = await createUser("deleter");
    const { clientId, postIds } = await seedClient(uploader.id, `Team Files ${suffix()}`, ["Teammate post"]);
    await insert("post_media", { post_id: postIds[0], url: publicUrl, position: 0 });
    await signIn(page, deleter.email);
    await page.goto(`/clients/${clientId}/posts/${postIds[0]}`);
    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete post" }).click();
    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}$`));

    await expect.poll(() => listUserFiles("post-media", uploader.id)).toEqual([]);
  });

  test("files of accounts outside the team are never touched by a member's deletes", async ({ page }) => {
    // A pending account is not a team member, so its folder is off limits.
    const other = await createUser("bystander", "Bystander", { approved: false });
    const otherPath = `${other.id}/keep/untouched.png`;
    const upload = await admin()
      .storage.from("post-media")
      .upload(otherPath, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    expect(upload.error).toBeNull();
    const publicUrl = admin().storage.from("post-media").getPublicUrl(otherPath).data.publicUrl;

    // A member's post references the bystander's URL (e.g. pasted), then is deleted.
    const owner = await createUser("owner-guard");
    const { clientId, postIds } = await seedClient(owner.id, `Guard ${suffix()}`, ["Borrowed"]);
    await insert("post_media", { post_id: postIds[0], url: publicUrl, position: 0 });
    await signIn(page, owner.email);
    await page.goto(`/clients/${clientId}/posts/${postIds[0]}`);
    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete post" }).click();
    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}$`));

    expect(await listUserFiles("post-media", other.id)).toEqual([otherPath]);
  });
});

test.describe("Share links (migration 0006/0007)", () => {
  test("comments-off / approvals-off links are enforced in the UI and on direct RPC calls", async ({ browser }) => {
    const owner = await createUser("viewonly");
    const { clientId, postIds } = await seedClient(owner.id, "View Only Client", ["Shared post"]);
    const { token } = await seedShareLink(clientId, { allowComments: false, allowApproval: false });

    const reviewer = await browser.newContext();
    const page = await reviewer.newPage();
    await page.goto(`/share/${token}`);
    await expect(page.getByRole("heading", { name: "View Only Client" })).toBeVisible();
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await expect(page.getByRole("button", { name: "Back to grid" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Comment only" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await reviewer.close();

    const comment = await anon().rpc("submit_share_comment", {
      share_token: token, p_post_id: postIds[0], p_author_name: "Mallory", p_author_email: null, p_body: "sneaky",
    });
    expect(comment.error?.message).toBe("comments_disabled");
    const approval = await anon().rpc("submit_share_approval", {
      share_token: token, p_post_id: postIds[0], p_reviewer_name: "Mallory", p_reviewer_email: null, p_status: "approved",
    });
    expect(approval.error?.message).toBe("approvals_disabled");
    // Direct table access is closed too.
    const { data: rows } = await anon().from("clients").select("id");
    expect(rows ?? []).toEqual([]);
  });

  test("a signed-in owner opening their own link sees THAT client (audit #3)", async ({ page }) => {
    const owner = await createUser("ownlink");
    await seedClient(owner.id, "First Client", ["One"]);
    const second = await seedClient(owner.id, "Second Client", ["Two"]);
    const { token } = await seedShareLink(second.clientId);
    await signIn(page, owner.email);
    await page.goto(`/share/${token}`);
    await expect(page.getByRole("heading", { name: "Second Client" })).toBeVisible();
  });

  test("reviewer comment → team notification (live bell) + activity entry", async ({ page, browser }) => {
    const owner = await createUser("notify");
    const { clientId } = await seedClient(owner.id, `Notify ${suffix()}`, ["Review me"]);
    const { token } = await seedShareLink(clientId);
    const reviewerName = `Rita ${suffix()}`;
    await signIn(page, owner.email);
    // Team-wide: earlier tests' notifications are unread for this new user too.
    const bell = page.getByRole("button", { name: /^Notifications/ });
    const unreadBefore = Number((await bell.getAttribute("aria-label"))?.match(/(\d+) unread/)?.[1] ?? 0);

    const reviewer = await browser.newContext();
    const review = await reviewer.newPage();
    await review.goto(`/share/${token}`);
    await review.getByLabel("Name").fill(reviewerName);
    await review.getByLabel("Email").fill("rita@example.test");
    await review.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await review.getByLabel(/Message/).fill("Lovely crop.");
    await review.getByRole("button", { name: "Comment only" }).click();
    await expect(review.locator("body")).toContainText("Comment sent");
    await reviewer.close();

    // Realtime: the owner's open dashboard updates without a reload.
    await expect(page.getByRole("button", { name: `Notifications, ${unreadBefore + 1} unread` })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("#main-content")).toContainText(`${reviewerName} left a comment`);
  });

  test("the per-link rate limit shows a clear message", async ({ browser }) => {
    const owner = await createUser("ratelimit");
    const { clientId } = await seedClient(owner.id, "Busy Client", ["Popular"]);
    const { token, linkId } = await seedShareLink(clientId);
    await insert(
      "share_submissions",
      Array.from({ length: 60 }, () => ({ share_link_id: linkId, kind: "comment" })),
    );

    const reviewer = await browser.newContext();
    const page = await reviewer.newPage();
    await page.goto(`/share/${token}`);
    await page.getByLabel("Name").fill("Rita Reviewer");
    await page.getByLabel("Email").fill("rita@example.test");
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await page.getByLabel(/Message/).fill("One more");
    await page.getByRole("button", { name: "Comment only" }).click();
    await expect(page.locator("body")).toContainText("Too many responses");
    await reviewer.close();
  });
});

test.describe("Content days (migration 0009)", () => {
  test("placing content stores a timezone-free date", async ({ page }) => {
    const owner = await createUser("contentday");
    const calendarClient = `Calendar ${suffix()}`;
    const { clientId } = await seedClient(owner.id, calendarClient);
    const [content] = await insert("posts", { client_id: clientId, name: "Live content", stage: "content" });
    await signIn(page, owner.email);

    await page.goto("/calendar");
    await page.getByRole("button", { name: calendarClient }).click();
    await page
      .locator('[role=group][aria-label^="Content package"]')
      .filter({ hasText: "Live content" })
      .getByRole("button", { name: "Schedule", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: /Schedule/ });
    await dialog.getByLabel("Date (DD/MM/YYYY)").fill("01/08/2026");
    await dialog.getByRole("button", { name: "Schedule" }).click();
    await expect(page.locator("body")).toContainText("Content placed");

    const { data } = await admin().from("posts").select("scheduled_day, scheduled_at").eq("id", content.id).single();
    expect(data).toEqual({ scheduled_day: "2026-08-01", scheduled_at: null });
  });
});

test.describe("Member actions + notification housekeeping (migration 0011)", () => {
  test("suspend blocks everything but keeps the account; restore gives access back", async ({ page, browser }) => {
    const owner = await ensureOwner();
    const clientName = `Suspend ${suffix()}`;
    await seedClient(owner.id, clientName, ["Team post"]);
    const member = await createUser("suspend", `Sid ${suffix()}`);

    await signIn(page, owner.email);
    await page.goto("/team");
    await page.getByRole("button", { name: `Suspend ${member.displayName}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Suspend" }).click();
    await expect(page.locator("body")).toContainText(`${member.displayName} was suspended`);

    // RLS, not just the UI: the suspended account's own API calls see nothing.
    const sb = await signedInClient(member.email);
    for (const table of ["clients", "posts", "notifications", "share_links"]) {
      const { data } = await sb.from(table).select("id");
      expect(data ?? [], `${table} is hidden`).toEqual([]);
    }
    const restoreSelf = await sb.rpc("restore_member", { p_user_id: member.id });
    expect(restoreSelf.error?.message).toBe("not_owner");

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await memberPage.goto("/login");
    await memberPage.getByLabel("Email").fill(member.email);
    await memberPage.getByLabel("Password").fill(PASSWORD);
    await memberPage.getByRole("button", { name: "Sign in" }).click();
    await expect(memberPage.getByRole("heading", { name: "Your access was suspended" })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: `Restore ${member.displayName}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Restore access" }).click();
    await expect(page.locator("body")).toContainText(`${member.displayName} can use the workspace again`);

    await memberPage.getByRole("button", { name: "Check again" }).click();
    await expect(memberPage.getByRole("heading", { name: /Welcome back,/ })).toBeVisible({ timeout: 30_000 });
    const { data: visible } = await sb.from("clients").select("name").eq("name", clientName);
    expect(visible).toHaveLength(1);
    await memberContext.close();
  });

  test("remove deletes the account, moves their clients to the owner, and their files stay cleanable", async ({ page }) => {
    const owner = await ensureOwner();
    const member = await createUser("leaver", `Lee ${suffix()}`);
    const clientName = `Leaver Client ${suffix()}`;
    const { clientId, postIds } = await seedClient(member.id, clientName, ["Leaver post"]);
    const filePath = `${member.id}/team/leaver.png`;
    const upload = await admin()
      .storage.from("post-media")
      .upload(filePath, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    expect(upload.error).toBeNull();
    const publicUrl = admin().storage.from("post-media").getPublicUrl(filePath).data.publicUrl;
    await insert("post_media", { post_id: postIds[0], url: publicUrl, position: 0 });

    await signIn(page, owner.email);
    await page.goto("/team");
    await page.getByRole("button", { name: `Remove ${member.displayName}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove and delete account" }).click();
    await expect(page.locator("body")).toContainText(`${member.displayName} was removed from the team`);

    const gone = await admin().auth.admin.getUserById(member.id);
    expect(gone.data.user).toBeNull();
    const { data: client } = await admin().from("clients").select("owner_id").eq("id", clientId).single();
    expect(client).toEqual({ owner_id: owner.id });
    // Still referenced by the moved client: kept.
    expect(await listUserFiles("post-media", member.id)).toEqual([filePath]);

    // Once nothing references it, the team's cleanup removes exactly that file.
    await page.goto(`/clients/${clientId}/posts/${postIds[0]}`);
    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete post" }).click();
    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}$`));
    await expect.poll(() => listUserFiles("post-media", member.id)).toEqual([]);
  });

  test("the owner's account can't be deleted; members can't use the owner actions", async () => {
    const owner = await ensureOwner();
    const refused = await admin().auth.admin.deleteUser(owner.id);
    expect(refused.error).not.toBeNull();
    const { data: still } = await admin().from("profiles").select("role").eq("id", owner.id).single();
    expect(still).toEqual({ role: "owner" });

    const member = await createUser("no-powers");
    const target = await createUser("target");
    const sb = await signedInClient(member.email);
    for (const fn of ["suspend_member", "restore_member", "remove_member"]) {
      const { error } = await sb.rpc(fn, { p_user_id: target.id });
      expect(error?.message, fn).toBe("not_owner");
    }
    const { data: kept } = await admin().from("profiles").select("status").eq("id", target.id).single();
    expect(kept).toEqual({ status: "approved" });
  });

  test("a sign-up notice resolves when the account is approved directly in the database", async () => {
    const owner = await ensureOwner();
    const pending = await createUser("dashboard-approve", "Dash Approve", { approved: false });
    const ownerSb = await signedInClient(owner.email);
    const notices = () =>
      ownerSb.from("notifications").select("id").eq("type", "member_signup").eq("subject_user_id", pending.id);
    expect((await notices()).data).toHaveLength(1);

    // The Table Editor path: a direct update, not the app's approve RPC.
    const update = await admin().from("profiles").update({ status: "approved" } as never).eq("id", pending.id);
    expect(update.error).toBeNull();
    expect((await notices()).data).toEqual([]);
  });

  test("Delete link on the previews page makes the URL stop working (members too)", async ({ page }) => {
    const owner = await ensureOwner();
    const clientName = `Delete Link ${suffix()}`;
    const { clientId } = await seedClient(owner.id, clientName, ["Shared"]);
    const { token } = await seedShareLink(clientId);
    const member = await createUser("link-deleter");
    expect((await anon().rpc("resolve_share", { share_token: token })).error).toBeNull();

    await signIn(page, member.email);
    await page.goto("/previews");
    const section = page.getByRole("region", { name: clientName });
    await section.getByRole("button", { name: "Delete link" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete link" }).click();
    await expect(page.locator("body")).toContainText("Link deleted");
    await expect(section).toHaveCount(0);

    const { error } = await anon().rpc("resolve_share", { share_token: token });
    expect(error?.message).toBe("not_found");
    await page.goto(`/share/${token}`);
    await expect(page.getByText("Preview not found")).toBeVisible();
  });
});
