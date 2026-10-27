import { expect, test, type Page } from "@playwright/test";
import { enterDemo, newClientButton, panelTab, paths } from "./helpers";

/*
 * Saving must wait for uploads still in progress. Demo-mode uploads are read
 * with FileReader; here each read is held until the test releases it, so
 * the "still uploading" state can be observed deterministically.
 */

async function holdUploads(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __releaseUploads?: () => void };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    w.__releaseUploads = release;
    const read = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (blob: Blob) {
      void gate.then(() => read.call(this, blob));
    };
  });
}

const releaseUploads = (page: Page) =>
  page.evaluate(() => (window as unknown as { __releaseUploads: () => void }).__releaseUploads());

test.describe("Saving waits for uploads in progress", () => {
  test("post composer: Create post shows Uploading… and is disabled until the file lands", async ({ page }) => {
    await holdUploads(page);
    await enterDemo(page, "/clients/client-kavo");
    await panelTab(page, "Posts").click();
    await page.getByRole("button", { name: "New post" }).click();
    const dialog = page.getByRole("dialog", { name: "New post" });
    await dialog.getByLabel("Post name").fill("Slow upload");
    await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("photo-1.png"));

    // Still uploading: the save button says so and can't be used.
    const save = dialog.getByRole("button", { name: "Uploading…" });
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(dialog.getByText("Add at least one media file.")).toHaveCount(0);

    await releaseUploads(page);
    await expect(dialog.getByRole("button", { name: "Remove slide 1" })).toBeVisible();
    await dialog.getByRole("button", { name: "Create post" }).click();
    await expect(page.locator("body")).toContainText("Post created");
    // The post was saved WITH its file: seed Kavo has 3 posts, now 4, the new one showing the image.
    await expect(page.locator(".ig-root .grid.grid-cols-3 > button")).toHaveCount(4);
    await expect(page.locator('.ig-root .grid.grid-cols-3 > button img[src^="data:"]')).toHaveCount(1);
  });

  test("new client: Create client waits for the profile picture", async ({ page }) => {
    await holdUploads(page);
    await enterDemo(page, "/clients");
    await newClientButton(page).click();
    const dialog = page.getByRole("dialog", { name: "New client" });
    await dialog.getByLabel("Client / business name").fill("Slow Avatar Co");
    await dialog.getByLabel("Instagram username").fill("slow.avatar");
    await dialog.locator('input[type="file"]').setInputFiles(paths.asset("avatar.png"));

    await expect(dialog.getByRole("button", { name: "Uploading…" })).toBeDisabled();
    await releaseUploads(page);
    await dialog.getByRole("button", { name: "Create client" }).click();
    await expect(page).toHaveURL(/\/clients\/[a-f0-9-]{36}/, { timeout: 15_000 });
    // Saved with the picture (rendered from the stored file).
    await expect(page.locator('.ig-root img[src^="data:image/png"]').first()).toBeVisible();
  });
});
