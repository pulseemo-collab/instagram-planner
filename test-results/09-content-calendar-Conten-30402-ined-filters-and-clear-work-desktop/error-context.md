# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 09-content-calendar.spec.ts >> Content page >> filters narrow results; combined filters and clear work
- Location: tests\e2e\09-content-calendar.spec.ts:6:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 10
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - link "Skip to main content" [ref=e4] [cursor=pointer]:
      - /url: "#main-content"
    - complementary [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]:
          - img [ref=e9]
          - generic [ref=e11]: Gridline Studio
        - navigation "Main navigation" [ref=e12]:
          - list [ref=e13]:
            - listitem [ref=e14]:
              - link "Overview" [ref=e15] [cursor=pointer]:
                - /url: /
                - img [ref=e16]
                - generic [ref=e21]: Overview
            - listitem [ref=e22]:
              - link "Clients" [ref=e23] [cursor=pointer]:
                - /url: /clients
                - img [ref=e24]
                - generic [ref=e29]: Clients
            - listitem [ref=e30]:
              - link "Content" [ref=e31] [cursor=pointer]:
                - /url: /content
                - img [ref=e32]
                - generic [ref=e37]: Content
            - listitem [ref=e38]:
              - link "Calendar" [ref=e39] [cursor=pointer]:
                - /url: /calendar
                - img [ref=e40]
                - generic [ref=e42]: Calendar
            - listitem [ref=e43]:
              - link "Shared previews" [ref=e44] [cursor=pointer]:
                - /url: /previews
                - img [ref=e45]
                - generic [ref=e51]: Shared previews
            - listitem [ref=e52]:
              - link "Settings" [ref=e53] [cursor=pointer]:
                - /url: /settings
                - img [ref=e54]
                - generic [ref=e57]: Settings
        - button "Collapse sidebar" [ref=e59]:
          - img [ref=e60]
          - generic [ref=e63]: Collapse
        - button "Aleandro Rossi Studio owner Open account menu" [ref=e65]:
          - generic [ref=e66]: AR
          - generic [ref=e67]:
            - generic [ref=e68]: Aleandro Rossi
            - generic [ref=e69]: Studio owner
          - img [ref=e70]
          - generic [ref=e73]: Open account menu
    - generic [ref=e74]:
      - banner [ref=e75]:
        - heading "Content" [level=1] [ref=e76]
        - generic [ref=e77]:
          - generic [ref=e78]:
            - img
            - searchbox "Search clients and posts" [ref=e79]
            - generic: ⌘K
          - button "Notifications (2 unread)" [ref=e80]:
            - img [ref=e81]
          - button "New client" [ref=e85]:
            - img [ref=e86]
            - generic [ref=e87]: New client
      - main [ref=e88]:
        - generic [ref=e90]:
          - generic [ref=e91]:
            - generic [ref=e92]:
              - img
              - searchbox "Search content" [ref=e93]
            - combobox "Filter by client" [ref=e94]:
              - option "All clients" [selected]
              - option "Maison Aurelle"
              - option "Studio Norr"
              - option "Kavo Coffee"
            - combobox "Filter by type" [ref=e95]:
              - option "All types" [selected]
              - option "Post"
              - option "Carousel"
              - option "Reel"
            - combobox "Filter by status" [ref=e96]:
              - option "All statuses" [selected]
              - option "Draft"
              - option "Scheduled"
              - option "Published"
            - combobox "Filter by approval" [ref=e97]:
              - option "All approvals" [selected]
              - option "Not sent"
              - option "Awaiting approval"
              - option "Approved"
              - option "Changes requested"
            - combobox "Filter by date" [ref=e98]:
              - option "Any date" [selected]
              - option "Scheduled · next 7 days"
              - option "Scheduled · next 30 days"
              - option "Unscheduled"
            - generic [ref=e99]:
              - radiogroup "View" [ref=e100]:
                - radio "Grid view" [checked] [ref=e101]:
                  - img [ref=e102]
                - radio "List view" [ref=e107]:
                  - img [ref=e108]
              - button "New post" [ref=e109]:
                - img [ref=e110]
                - text: New post
          - list [ref=e111]:
            - listitem [ref=e112]:
              - link "Open post for Studio Norr" [ref=e113] [cursor=pointer]:
                - /url: /clients/client-norr/posts/post-n5
              - checkbox "Select post from Studio Norr" [ref=e117]
              - generic [ref=e118]:
                - paragraph [ref=e119]: Studio Norr · Post
                - generic [ref=e120]:
                  - generic [ref=e121]: Draft
                  - generic [ref=e122]: Not sent
                - paragraph [ref=e123]: Updated 1d ago
            - listitem [ref=e124]:
              - link "Open post for Kavo Coffee" [ref=e125] [cursor=pointer]:
                - /url: /clients/client-kavo/posts/post-k3
              - checkbox "Select post from Kavo Coffee" [ref=e129]
              - generic [ref=e130]:
                - paragraph [ref=e131]: Kavo Coffee · Reel
                - generic [ref=e132]:
                  - generic [ref=e133]: Draft
                  - generic [ref=e134]: Not sent
                - paragraph [ref=e135]: Updated 1d ago
            - listitem [ref=e136]:
              - link "Open post for Maison Aurelle" [ref=e137] [cursor=pointer]:
                - /url: /clients/client-aurelle/posts/post-a8
              - checkbox "Select post from Maison Aurelle" [ref=e141]
              - generic [ref=e142]:
                - paragraph [ref=e143]: Maison Aurelle · Post
                - generic [ref=e144]:
                  - generic [ref=e145]: Draft
                  - generic [ref=e146]: Not sent
                - paragraph [ref=e147]: Updated 2d ago
            - listitem [ref=e148]:
              - link "Open post for Kavo Coffee" [ref=e149] [cursor=pointer]:
                - /url: /clients/client-kavo/posts/post-k2
              - checkbox "Select post from Kavo Coffee" [ref=e153]
              - generic [ref=e154]:
                - paragraph [ref=e155]: Kavo Coffee · Post
                - generic [ref=e156]:
                  - generic [ref=e157]: Draft
                  - generic [ref=e158]: Changes requested
                - paragraph [ref=e159]: Updated 3d ago
            - listitem [ref=e160]:
              - link "Open post for Maison Aurelle" [ref=e161] [cursor=pointer]:
                - /url: /clients/client-aurelle/posts/post-a5
              - checkbox "Select post from Maison Aurelle" [ref=e165]
              - generic [ref=e166]:
                - paragraph [ref=e167]: Maison Aurelle · Carousel
                - generic [ref=e168]:
                  - generic [ref=e169]: Draft
                  - generic [ref=e170]: Changes requested
                - paragraph [ref=e171]: Updated 4d ago
            - listitem [ref=e172]:
              - link "Open post for Kavo Coffee" [ref=e173] [cursor=pointer]:
                - /url: /clients/client-kavo/posts/post-k1
              - checkbox "Select post from Kavo Coffee" [ref=e177]
              - generic [ref=e178]:
                - paragraph [ref=e179]: Kavo Coffee · Carousel
                - generic [ref=e180]:
                  - generic [ref=e181]: Scheduled
                  - generic [ref=e182]: Awaiting approval
                - paragraph [ref=e183]: Jul 22, 2026 · 9:00 AM
            - listitem [ref=e184]:
              - link "Open post for Maison Aurelle" [ref=e185] [cursor=pointer]:
                - /url: /clients/client-aurelle/posts/post-a4
              - checkbox "Select post from Maison Aurelle" [ref=e189]
              - generic [ref=e190]:
                - paragraph [ref=e191]: Maison Aurelle · Post
                - generic [ref=e192]:
                  - generic [ref=e193]: Draft
                  - generic [ref=e194]: Not sent
                - paragraph [ref=e195]: Updated 5d ago
            - listitem [ref=e196]:
              - link "Open post for Maison Aurelle" [ref=e197] [cursor=pointer]:
                - /url: /clients/client-aurelle/posts/post-a3
              - checkbox "Select post from Maison Aurelle" [ref=e201]
              - generic [ref=e202]:
                - paragraph [ref=e203]: Maison Aurelle · Reel
                - generic [ref=e204]:
                  - generic [ref=e205]: Scheduled
                  - generic [ref=e206]: Awaiting approval
                - paragraph [ref=e207]: Jul 23, 2026 · 5:00 PM
            - listitem [ref=e208]:
              - link "Open post for Maison Aurelle" [ref=e209] [cursor=pointer]:
                - /url: /clients/client-aurelle/posts/post-a2
              - checkbox "Select post from Maison Aurelle" [ref=e213]
              - generic [ref=e214]:
                - paragraph [ref=e215]: Maison Aurelle · Carousel
                - generic [ref=e216]:
                  - generic [ref=e217]: Scheduled
                  - generic [ref=e218]: Approved
                - paragraph [ref=e219]: Jul 21, 2026 · 12:00 PM
            - listitem [ref=e220]:
              - link "Open post for Studio Norr" [ref=e221] [cursor=pointer]:
                - /url: /clients/client-norr/posts/post-n3
              - checkbox "Select post from Studio Norr" [ref=e225]
              - generic [ref=e226]:
                - paragraph [ref=e227]: Studio Norr · Post
                - generic [ref=e228]:
                  - generic [ref=e229]: Scheduled
                  - generic [ref=e230]: Approved
                - paragraph [ref=e231]: Jul 26, 2026 · 11:00 AM
            - listitem [ref=e232]:
              - link "Open post for Studio Norr" [ref=e233] [cursor=pointer]:
                - /url: /clients/client-norr/posts/post-n4
              - checkbox "Select post from Studio Norr" [ref=e237]
              - generic [ref=e238]:
                - paragraph [ref=e239]: Studio Norr · Post
                - generic [ref=e240]:
                  - generic [ref=e241]: Published
                  - generic [ref=e242]: Approved
                - paragraph [ref=e243]: Updated 1w ago
            - listitem [ref=e244]:
              - link "Open post for Maison Aurelle" [ref=e245] [cursor=pointer]:
                - /url: /clients/client-aurelle/posts/post-a1
              - checkbox "Select post from Maison Aurelle" [ref=e249]
              - generic [ref=e250]:
                - paragraph [ref=e251]: Maison Aurelle · Post
                - generic [ref=e252]:
                  - generic [ref=e253]: Scheduled
                  - generic [ref=e254]: Awaiting approval
                - paragraph [ref=e255]: Jul 19, 2026 · 12:00 PM
            - listitem [ref=e256]:
              - link "Open post for Studio Norr" [ref=e257] [cursor=pointer]:
                - /url: /clients/client-norr/posts/post-n2
              - checkbox "Select post from Studio Norr" [ref=e261]
              - generic [ref=e262]:
                - paragraph [ref=e263]: Studio Norr · Reel
                - generic [ref=e264]:
                  - generic [ref=e265]: Scheduled
                  - generic [ref=e266]: Approved
                - paragraph [ref=e267]: Jul 20, 2026 · 5:00 PM
            - listitem [ref=e268]:
              - link "Open post for Studio Norr" [ref=e269] [cursor=pointer]:
                - /url: /clients/client-norr/posts/post-n1
              - checkbox "Select post from Studio Norr" [ref=e273]
              - generic [ref=e274]:
                - paragraph [ref=e275]: Studio Norr · Carousel
                - generic [ref=e276]:
                  - generic [ref=e277]: Scheduled
                  - generic [ref=e278]: Approved
                - paragraph [ref=e279]: Jul 18, 2026 · 6:00 PM
            - listitem [ref=e280]:
              - link "Open post for Maison Aurelle" [ref=e281] [cursor=pointer]:
                - /url: /clients/client-aurelle/posts/post-a6
              - checkbox "Select post from Maison Aurelle" [ref=e285]
              - generic [ref=e286]:
                - paragraph [ref=e287]: Maison Aurelle · Post
                - generic [ref=e288]:
                  - generic [ref=e289]: Published
                  - generic [ref=e290]: Approved
                - paragraph [ref=e291]: Updated 2w ago
            - listitem [ref=e292]:
              - link "Open post for Maison Aurelle" [ref=e293] [cursor=pointer]:
                - /url: /clients/client-aurelle/posts/post-a7
              - checkbox "Select post from Maison Aurelle" [ref=e297]
              - generic [ref=e298]:
                - paragraph [ref=e299]: Maison Aurelle · Reel
                - generic [ref=e300]:
                  - generic [ref=e301]: Published
                  - generic [ref=e302]: Approved
                - paragraph [ref=e303]: Updated 3w ago
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | import fs from "node:fs";
  3   | import { enterDemo, enterDemoCalendar, evidence, paths } from "./helpers";
  4   | 
  5   | test.describe("Content page", () => {
  6   |   test("filters narrow results; combined filters and clear work", async ({ page }) => {
  7   |     await enterDemo(page, "/content");
  8   |     const cards = page.locator("ul li", { has: page.locator('a[href*="/posts/"]') });
  9   |     const total = await cards.count();
> 10  |     expect(total).toBeGreaterThan(10);
      |                   ^ Error: expect(received).toBeGreaterThan(expected)
  11  | 
  12  |     await page.getByLabel("Filter by client").selectOption({ label: "Kavo Coffee" });
  13  |     await expect.poll(async () => cards.count()).toBeLessThan(total);
  14  | 
  15  |     await page.getByLabel("Filter by type").selectOption("reel");
  16  |     await expect.poll(async () => cards.count()).toBe(1);
  17  | 
  18  |     await page.getByLabel("Filter by client").selectOption("all");
  19  |     await page.getByLabel("Filter by type").selectOption("all");
  20  |     await expect.poll(async () => cards.count()).toBe(total);
  21  | 
  22  |     await page.getByLabel("Search content").fill("travertine");
  23  |     await expect.poll(async () => cards.count()).toBe(2); // Norr carousel + material study
  24  |     await page.getByLabel("Search content").fill("zzz-no-match");
  25  |     await expect(page.getByText("No matches")).toBeVisible();
  26  |   });
  27  | 
  28  |   test("list view renders and per-row edit opens the composer", async ({ page }) => {
  29  |     await enterDemo(page, "/content");
  30  |     await page.getByRole("radio", { name: "List view" }).click();
  31  |     await expect(page.locator("table")).toBeVisible();
  32  |     await page.locator("table tbody tr").first().getByRole("button", { name: "Edit" }).click();
  33  |     await expect(page.getByRole("dialog", { name: "Edit post" })).toBeVisible();
  34  |     await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  35  |   });
  36  | 
  37  |   test("bulk select + bulk approval change updates statuses @smoke", async ({ page }) => {
  38  |     await enterDemo(page, "/content");
  39  |     await page.getByLabel("Filter by client").selectOption({ label: "Kavo Coffee" });
  40  |     const checkboxes = page.locator('input[type="checkbox"]');
  41  |     await checkboxes.nth(0).check();
  42  |     await checkboxes.nth(1).check();
  43  |     await expect(page.getByText("2 selected")).toBeVisible();
  44  |     await page.getByRole("button", { name: "Mark approved" }).click();
  45  |     await expect(page.locator("body")).toContainText("2 posts updated");
  46  |     await expect(page.locator("li", { hasText: "Approved" }).first()).toBeVisible();
  47  |     await evidence(page, "content", "bulk-approved");
  48  |   });
  49  | });
  50  | 
  51  | /* ------------------------------------------------------------------------- */
  52  | /* Calendar — designer content packages become scheduler-created posts       */
  53  | /* ------------------------------------------------------------------------- */
  54  | 
  55  | const dayCell = (page: Page) => page.locator(".grid.grid-cols-7 > div");
  56  | const chips = (page: Page) => page.locator(".grid.grid-cols-7 button[draggable]");
  57  | const contentCards = (page: Page) =>
  58  |   page.locator('[role=group][aria-label^="Content package"]');
  59  | 
  60  | async function addContent(page: Page, name: string, files: string[]): Promise<void> {
  61  |   await page.getByRole("button", { name: "Add content" }).first().click();
  62  |   const dialog = page.getByRole("dialog", { name: "Add content" });
  63  |   await dialog.getByLabel("Content name").fill(name);
  64  |   await dialog.locator('input[type="file"]').first().setInputFiles(files.map(paths.asset));
  65  |   await dialog.getByRole("button", { name: "Add content" }).click();
  66  |   await expect(page.locator("body")).toContainText("Content added");
  67  | }
  68  | 
  69  | test.describe("Calendar workspace", () => {
  70  |   test("requires one selected client; no All-clients option @smoke", async ({ page }) => {
  71  |     await enterDemo(page, "/calendar");
  72  |     await expect(page.getByRole("heading", { name: "Choose a client" })).toBeVisible();
  73  |     await expect(page.locator(".grid.grid-cols-7")).toHaveCount(0);
  74  |     await expect(page.getByText("All clients")).toHaveCount(0);
  75  |     await evidence(page, "calendar", "client-selection-state");
  76  | 
  77  |     await page.getByRole("button", { name: /Maison Aurelle/ }).click();
  78  |     await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible();
  79  |     await expect(page.getByLabel("Switch client")).toHaveValue("client-aurelle");
  80  |     await expect(page.getByText("All clients")).toHaveCount(0);
  81  |     // Seeded designer packages for Aurelle.
  82  |     await expect(contentCards(page)).toHaveCount(2);
  83  | 
  84  |     await page.reload();
  85  |     await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible();
  86  |     await expect(page.getByLabel("Switch client")).toHaveValue("client-aurelle");
  87  |   });
  88  | 
  89  |   test("Add content dialog is minimal: name + media only @smoke", async ({ page }) => {
  90  |     await enterDemoCalendar(page, "client-kavo");
  91  |     await page.getByRole("button", { name: "Add content" }).first().click();
  92  |     const dialog = page.getByRole("dialog", { name: "Add content" });
  93  | 
  94  |     // Exactly the designer fields — nothing else.
  95  |     await expect(dialog.getByLabel("Content name")).toBeVisible();
  96  |     await expect(dialog.locator('input[type="file"]')).toHaveCount(1);
  97  |     for (const absent of [
  98  |       "Caption",
  99  |       "Hashtags",
  100 |       "Location",
  101 |       "Alt text",
  102 |       "Post type",
  103 |       "Approval status",
  104 |     ]) {
  105 |       await expect(dialog.getByLabel(absent)).toHaveCount(0);
  106 |     }
  107 |     await expect(dialog.getByRole("switch")).toHaveCount(0);
  108 | 
  109 |     // Name is required.
  110 |     await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("photo-1.png"));
```