import { expect, test } from "@playwright/test";
import { panelTab, paths } from "../e2e/helpers";
import {
  PASSWORD,
  admin,
  anon,
  createUser,
  insert,
  latestEmailText,
  listUserFiles,
  seedClient,
  seedShareLink,
  signIn,
  uniqueEmail,
} from "./helpers";

/*
 * Live mode end to end: the real SupabaseRepository, RLS, the 0006–0009
 * RPCs and triggers, Storage and Auth — against the LOCAL stack started by
 * `supabase start` in CI. Each test creates its own users and data.
 */

test.describe("Auth", () => {
  test("signup with email confirmation: check-your-inbox, confirm link, then sign in", async ({ page }) => {
    const email = uniqueEmail("signup");
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("New Owner");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await expect(page.locator("body")).toContainText(email);

    const mail = await latestEmailText(email);
    const link = mail.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/)?.[0];
    expect(link, "confirmation link in the email").toBeTruthy();
    await page.goto(link!.replace(/&amp;/g, "&"));

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back, New" })).toBeVisible({ timeout: 30_000 });
    // Live builds have no demo entry.
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue in demo mode" })).toHaveCount(0);
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

  test("another user's files are never touched by the owner's deletes", async ({ page }) => {
    const other = await createUser("bystander");
    const otherPath = `${other.id}/keep/untouched.png`;
    const upload = await admin()
      .storage.from("post-media")
      .upload(otherPath, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    expect(upload.error).toBeNull();
    const publicUrl = admin().storage.from("post-media").getPublicUrl(otherPath).data.publicUrl;

    // The owner's post references the bystander's URL (e.g. pasted), then is deleted.
    const owner = await createUser("owner-guard");
    const { clientId, postIds } = await seedClient(owner.id, "Guard Client", ["Borrowed"]);
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

  test("reviewer comment → owner notification (live bell) + activity entry", async ({ page, browser }) => {
    const owner = await createUser("notify");
    const { clientId } = await seedClient(owner.id, "Notify Client", ["Review me"]);
    const { token } = await seedShareLink(clientId);
    await signIn(page, owner.email);
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();

    const reviewer = await browser.newContext();
    const review = await reviewer.newPage();
    await review.goto(`/share/${token}`);
    await review.getByLabel("Name").fill("Rita Reviewer");
    await review.getByLabel("Email").fill("rita@example.test");
    await review.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await review.getByLabel(/Message/).fill("Lovely crop.");
    await review.getByRole("button", { name: "Comment only" }).click();
    await expect(review.locator("body")).toContainText("Comment sent");
    await reviewer.close();

    // Realtime: the owner's open dashboard updates without a reload.
    await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#main-content")).toContainText("Rita Reviewer left a comment");
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
    const { clientId } = await seedClient(owner.id, "Calendar Client");
    const [content] = await insert("posts", { client_id: clientId, name: "Live content", stage: "content" });
    await signIn(page, owner.email);

    await page.goto("/calendar");
    await page.getByRole("button", { name: /Calendar Client/ }).click();
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
