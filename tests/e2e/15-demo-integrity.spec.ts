import { expect, test, type Page } from "@playwright/test";
import { enterDemo, newClientButton, panelTab, paths, waitForDashboard } from "./helpers";

/** 1×1 transparent PNG — a stand-in for media inlined by older versions. */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** The stored workspace snapshot (the IndexedDB "state" record), as JSON. */
function storedStateJson(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("gridline-studio", 1);
        open.onsuccess = () => {
          const db = open.result;
          const rq = db.transaction("state", "readonly").objectStore("state").get("workspace-v1");
          rq.onsuccess = () => {
            resolve(JSON.stringify(rq.result));
            db.close();
          };
          rq.onerror = () => reject(rq.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
}

/** Keys of the IndexedDB "media" store (one per stored upload). */
function mediaKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("gridline-studio", 1);
        open.onsuccess = () => {
          const db = open.result;
          const rq = db.transaction("media", "readonly").objectStore("media").getAllKeys();
          rq.onsuccess = () => {
            resolve(rq.result.map(String));
            db.close();
          };
          rq.onerror = () => reject(rq.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
}

async function createPhotoPost(page: Page, clientId: string, name: string): Promise<void> {
  await enterDemo(page, `/clients/${clientId}`);
  await panelTab(page, "Posts").click();
  await page.getByRole("button", { name: "New post" }).click();
  const dialog = page.getByRole("dialog", { name: "New post" });
  await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("photo-1.png"));
  // Upload finished: the file is a slide in the post, and saving is enabled.
  await expect(dialog.getByRole("button", { name: "Remove slide 1" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create post" })).toBeEnabled();
  await dialog.getByLabel("Post name").fill(name);
  await dialog.getByRole("button", { name: "Create post" }).click();
  await expect(page.locator("body")).toContainText("Post created");
}

test.describe("Demo data integrity", () => {
  test("editing a post never writes inline data: media into the stored state", async ({ page }) => {
    await createPhotoPost(page, "client-kavo", "Integrity post");
    const keysAfterCreate = await mediaKeys(page);
    expect(keysAfterCreate).toHaveLength(1);

    // The editor works with the resolved (data:) image; saving it twice must
    // keep the original local: reference instead of inlining the file.
    await page.locator(".ig-root .grid.grid-cols-3 > button").last().click();
    const editor = page.locator('section[aria-label="Edit post"]');
    for (const caption of ["edited once", "edited twice"]) {
      await editor.getByLabel("Caption").fill(caption);
      await editor.getByRole("button", { name: "Save changes" }).click();
      await expect(page.locator("body")).toContainText("Post updated");
    }

    const state = await storedStateJson(page);
    expect(state).not.toContain("data:");
    expect(state).toContain(`local:${keysAfterCreate[0]}`);
    expect(await mediaKeys(page)).toEqual(keysAfterCreate);
  });

  test("a state saved with inline media is repaired on load", async ({ page }) => {
    await enterDemo(page, "/");
    await waitForDashboard(page);

    // Simulate a workspace saved by an older version: inline avatar.
    await page.evaluate(
      (dataUrl) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("gridline-studio", 1);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("state", "readwrite");
            const store = tx.objectStore("state");
            const get = store.get("workspace-v1");
            get.onsuccess = () => {
              const state = get.result as { clients: Array<{ id: string; avatarUrl: string | null }> };
              state.clients.find((c) => c.id === "client-kavo")!.avatarUrl = dataUrl;
              store.put(state, "workspace-v1");
            };
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          open.onerror = () => reject(open.error);
        }),
      TINY_PNG,
    );

    await page.reload();
    await waitForDashboard(page);

    const state = JSON.parse(await storedStateJson(page)) as {
      clients: Array<{ id: string; avatarUrl: string | null }>;
    };
    const avatar = state.clients.find((c) => c.id === "client-kavo")!.avatarUrl;
    expect(JSON.stringify(state)).not.toContain("data:");
    expect(avatar).toMatch(/^local:/);
    expect(await mediaKeys(page)).toEqual([avatar!.slice("local:".length)]);

    // …and it still displays as the same image.
    await page.goto("/clients/client-kavo");
    await expect(page.locator(`.ig-root img[src="${TINY_PNG}"]`).first()).toBeVisible();
  });

  test("deleting a post removes its stored media", async ({ page }) => {
    await createPhotoPost(page, "client-kavo", "Short-lived post");
    expect(await mediaKeys(page)).toHaveLength(1);

    await page.locator(".ig-root .grid.grid-cols-3 > button").last().click();
    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete post" }).click();
    await expect(page).toHaveURL(/\/clients\/client-kavo$/);

    await expect.poll(() => mediaKeys(page)).toHaveLength(0);
  });

  test("two tabs writing in turn don't overwrite each other", async ({ page, context }) => {
    // Both tabs load the workspace first, so each holds a cached copy.
    await enterDemo(page, "/clients");
    const other = await context.newPage();
    await enterDemo(other, "/clients");

    for (const [tab, name, username] of [
      [page, "Tab A Studio", "tab.a.studio"],
      [other, "Tab B Studio", "tab.b.studio"],
    ] as const) {
      await newClientButton(tab).click();
      const dialog = tab.getByRole("dialog", { name: "New client" });
      await dialog.getByLabel("Client / business name").fill(name);
      await dialog.getByLabel("Instagram username").fill(username);
      await dialog.getByRole("button", { name: "Create client" }).click();
      await expect(tab).toHaveURL(/\/clients\/[a-f0-9-]{36}/, { timeout: 15_000 });
    }

    await page.goto("/clients");
    await expect(page.locator("#main-content")).toContainText("Tab A Studio");
    await expect(page.locator("#main-content")).toContainText("Tab B Studio");
    await other.close();
  });

  test("share page keeps uploaded images after a reviewer comment", async ({ page }) => {
    await createPhotoPost(page, "client-aurelle", "Share image check");

    await page.goto("/share/demo-aurelle-h3ritage");
    await page.getByLabel("Name").fill("Rita Reviewer");
    await page.getByLabel("Email").fill("rita@example.com");
    await page.locator('.ig-root .grid.grid-cols-3 > button:has(img[src^="data:"])').click();
    await expect(page.locator('.ig-root img[src^="data:"]').first()).toBeVisible();

    await page.getByLabel(/Message/).fill("Love this shot.");
    await page.getByRole("button", { name: "Comment only" }).click();
    await expect(page.locator("body")).toContainText("Comment sent");
    // After the post-comment refresh the real image is still shown.
    await expect(page.locator('.ig-root img[src^="data:"]').first()).toBeVisible();
  });
});
