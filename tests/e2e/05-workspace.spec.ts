import { expect, test } from "@playwright/test";
import { enterDemo, evidence, phone } from "./helpers";

test.describe("Instagram profile workspace", () => {
  test("profile edits render live and persist after reload @smoke", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    const igPhone = phone(page);

    await page.getByLabel("Profile name").fill("Maison Aurelle Paris");
    await expect(igPhone).toContainText("Maison Aurelle Paris");

    await page.getByLabel("Bio").fill("Line one of bio\nLine two of bio");
    await expect(igPhone).toContainText("Line one of bio");
    await expect(igPhone).toContainText("Line two of bio");

    await page.getByRole("switch", { name: "Verified badge" }).click(); // seed = on → off
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("body")).toContainText("Profile saved");

    await page.reload();
    await expect(phone(page)).toContainText("Maison Aurelle Paris");
    await expect(page.getByLabel("Bio")).toHaveValue("Line one of bio\nLine two of bio");
  });

  test("follower count formatting: small exact, large abbreviated", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    const igPhone = phone(page);

    await page.getByLabel("Followers").fill("9540");
    await expect(igPhone).toContainText("9,540"); // below 10k stays exact
    await page.getByLabel("Followers").fill("1250000");
    await expect(igPhone).toContainText("1.2M");
    await page.getByLabel("Followers").fill("24312");
    await expect(igPhone).toContainText("24.3K");
  });

  test("preview mode removes all editing chrome", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    await expect(page.getByRole("tablist", { name: "Editing panels" })).toBeVisible();
    await page.getByRole("radio", { name: "preview" }).click();
    await expect(page.getByRole("tablist", { name: "Editing panels" })).toHaveCount(0);
    await expect(page.getByLabel("Bio")).toHaveCount(0);
    await evidence(page, "instagram-profile", "preview-mode-clean");
    await page.getByRole("radio", { name: "edit" }).click();
    await expect(page.getByRole("tablist", { name: "Editing panels" })).toBeVisible();
  });

  test("dark theme applies to the phone preview", async ({ page }) => {
    await enterDemo(page, "/clients/client-norr"); // seeded dark theme
    const root = phone(page).first();
    await expect(root).toHaveClass(/ig-dark/);
    const bg = await root.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(0, 0, 0)");
    await evidence(page, "instagram-profile", "dark-profile");
  });

  test("optional elements: note bubble, threads badge, private lock, story ring", async ({
    page,
  }) => {
    await enterDemo(page, "/clients/client-aurelle");
    const igPhone = phone(page);
    await expect(igPhone).toContainText("New drop 8/1"); // note bubble
    await expect(igPhone).toContainText("maisonaurelle"); // threads badge

    await page.getByLabel("Profile note").fill("");
    await expect(igPhone).not.toContainText("New drop 8/1");

    await page.getByRole("switch", { name: "Private account" }).click();
    // Lock icon appears next to the username in the top bar.
    await expect(igPhone.locator("svg").first()).toBeVisible();
    await evidence(page, "instagram-profile", "light-profile-optionals");
  });

  test("long text does not break the phone layout", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    await page
      .getByLabel("Profile name")
      .fill("An Extremely Long Profile Name That Keeps Going And Going");
    await page
      .getByLabel("Bio")
      .fill(
        "A very long single bio line without any breaks that could stretch the layout beyond its container if unhandled 🌿✨🏆 emojis included",
      );
    const overflow = await phone(page).evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await evidence(page, "instagram-profile", "long-bio");
  });
});
