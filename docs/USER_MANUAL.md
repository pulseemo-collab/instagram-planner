# Gridline Studio — User Manual

*A complete guide to planning, previewing, and approving Instagram content with your
clients. Written for the current version of the application; every workflow below was
verified in a real browser.*

---

## 1. What the application does

Gridline Studio is a planning tool for content creators and social-media agencies. For
each client you manage, it gives you:

- a **realistic Instagram phone preview** of their profile — grid, highlights, bio,
  reels, post details — exactly as followers would see it;
- an **editing workspace** around that preview for profile info, highlights, posts,
  and scheduling;
- a **share link** you can send to the client, where they review the planned feed and
  **approve posts or request changes** without creating an account;
- a **dashboard, content library, and calendar** that stay in sync with every change.

Nothing is ever published to Instagram — the app is a planning and approval space.

---

## 2. Login and demo mode

**Where:** `/login` (you are sent here automatically when signed out).

- **Demo mode** — click **Continue in demo mode**. No account is required. All data is
  stored inside your browser and persists across refreshes. Three sample clients are
  pre-loaded. This is the default when the app has no Supabase configuration.
- **Live mode** — when the app is connected to Supabase, use your email and password,
  or create an account on `/signup` (name, email, password of 8+ characters). After
  signing in you are returned to the page you originally requested.
- Validation problems (missing email, short password, invalid address) appear under
  the corresponding fields.

**Common mistake:** in demo mode the email/password form does not create real
accounts — the app tells you so and points you to the demo button.

### Signing out

**Settings → Session → Sign out.** You return to the login page and dashboard pages
become inaccessible until you sign in (or re-enter demo mode). Demo data itself is
*not* deleted by signing out.

---

## 3. Dashboard overview

**Where:** `/` (Overview in the sidebar).

- **Four summary cards** — Active clients, Draft posts, Awaiting approval, Scheduled
  this month. These are computed live from your actual data and update immediately
  after you create, schedule, approve, or delete anything.
- **Recent client projects** — one card per client with their avatar, name, username,
  a real miniature of their planned grid, prepared-post count, last-update time, and
  an approval roll-up badge. Clicking a card opens that client's workspace.
- **Upcoming content** — the next scheduled posts across all clients, each linking to
  its post detail.
- **Recent activity** — approvals, change requests, comments, uploads, scheduling
  events, newest first.

The greeting line summarizes how many posts wait on approval and when the next
scheduled post goes out.

---

## 4. Sidebar navigation

- **Overview, Clients, Content, Calendar, Shared previews, Settings** — the six main
  areas. The active item is highlighted with an accent marker.
- **Collapse** shrinks the sidebar to an icon rail on desktop; expand it the same way.
- On **mobile**, the sidebar becomes a drawer: open it with the menu button (top-left),
  close it with the X, the Escape key, or by tapping the backdrop. Navigating closes
  it automatically.
- The top bar always offers **search** (visual placeholder — see Limitations),
  **notifications** (indicator only), and the **New client** button.

---

## 5. Creating a client

**Where:** the **New client** button (top bar on every page, or on `/clients`).

1. Click **New client**.
2. Fill **Client / business name** (required) and **Instagram username** (required —
   letters, numbers, dots, underscores, max 30).
3. Optionally: **Profile name** (defaults to the client name), **profile picture**
   (drag a JPG/PNG/WEBP onto the upload area or click it to browse), **account type**
   (Business / Creator / Personal), and **preview theme** (Light / Dark).
4. Click **Create client**.

**Afterward:** the client is saved, an activity entry is recorded, and you are taken
straight to their workspace at `/clients/<id>`.

---

## 6. Editing, duplicating, and deleting a client

**Where:** `/clients`, via the **⋯ menu** on each card (or the ⋯ menu inside the
workspace toolbar).

- **Edit details** — reopens the creation dialog with current values.
- **Duplicate** — creates "«Name» copy" including all posts, media, and highlights.
  Useful for seasonal variants or testing a different feed order.
- **Delete** — asks for confirmation, then permanently removes the client *and* all
  their posts, highlights, comments, approvals, and share links. This cannot be
  undone.

The clients page also provides **search** (name or username), an **approval-state
filter**, and **sorting** by recent update or name.

---

## 7. The client workspace

**Where:** `/clients/<clientId>` — open it from any client card.

Layout: a toolbar on top, the Instagram phone preview in the center/left, and (in edit
mode) an editing panel on the right.

**Toolbar:** back to Clients, client name and username, the **Edit / Preview** mode
switch, **Share**, and a ⋯ menu (duplicate, delete).

- **Edit mode** — the editing panel is visible and the grid supports reordering.
- **Preview mode** — every editing control disappears; you see only the clean
  Instagram interface, exactly what a reviewer sees. Use this for screenshots or
  client calls.

### 7.1 Editing profile information

Open the **Profile** panel tab. Every field updates the phone preview **live as you
type**; nothing is stored until you press **Save profile** (the button stays disabled
while there is nothing to save, and the panel shows "Unsaved changes" otherwise).

Fields: profile picture (upload), username, profile name, category (e.g.
"Jewelry/Watches"), bio (each line in the box is a line on the profile), website,
Threads username (renders the Threads badge chip), profile note (the small bubble
above the avatar, max 60 characters — clear it to remove the bubble), posts /
followers / following counts, account type, preview theme (light/dark), **verified
badge** toggle, **private account** toggle (adds the lock next to the username).

Counts format exactly like Instagram: below 10,000 they show in full (`9,540`), above
that abbreviated (`24.3K`, `1.2M`).

**Common mistake:** navigating away with unsaved changes discards the draft — save
first.

### 7.2 Changing light/dark preview

Profile panel → **Preview theme**. The phone flips immediately between Instagram's
light and dark palettes; reviewers see the same theme on share links.

---

## 8. Managing highlights

**Where:** workspace → **Highlights** panel tab.

- **Create** — "New highlight", enter a title (required, ≤30 chars), optionally upload
  a cover image, save. It appears instantly in the highlights row on the phone.
- **Edit** — pencil icon; change title or cover.
- **Reorder** — the ← and → buttons move a highlight earlier/later; the profile
  updates immediately and the order persists.
- **Delete** — trash icon, with confirmation.
- The phone's highlight row scrolls horizontally when there are many, and (on your own
  profile view) ends with Instagram's "New +" bubble. A client with no highlights
  shows a friendly empty state in the panel and no highlight row clutter on the phone.

---

## 9. Uploading media

Upload areas appear wherever media is needed (profile picture, highlight cover, post
media, reel cover). All of them support:

- **Drag & drop** onto the dashed area, or **click** it to open the file picker
  (multi-select where multiple files make sense).
- **Formats:** JPG/JPEG, PNG, WEBP images; MP4, WebM, MOV videos (reels only).
- **Size limits:** 12 MB per image, 25 MB per video.
- A per-file row with preview thumbnail, **progress bar**, an error message when a
  file is rejected (wrong type, too large), a **retry** button for failed uploads, and
  an **X** to remove a file before saving.

Rejected files never silently disappear — the reason is shown inline.

**Demo mode:** files are stored inside your browser (as data URLs in IndexedDB) and
survive refreshes. **Live mode:** files upload to Supabase Storage and get public
URLs.

---

## 10. Creating posts

**Where:** workspace → **Posts** panel tab → **New post** (also from `/content`).

Choose the **post type** first (the composer also infers it: multiple files → carousel,
a video → reel).

### 10.1 Single image post

1. Upload one image.
2. Write the **caption** (emoji and unicode are fine), **hashtags** (space-separated,
   the `#` is optional — they are normalized), **location**, **alt text**.
3. Optionally set **approval status**, **pin**, or a **schedule** (below).
4. **Create post.** The tile appears in the grid immediately.

### 10.2 Carousel

1. Set type to **Carousel** and upload two or more images (multi-select works).
2. Each slide shows its number; use the ← → controls on a slide to **reorder**, or the
   X to **remove** it. You can add more files at any time.
3. A carousel must keep at least two slides — the composer blocks saving otherwise.

The first slide becomes the grid cover, the tile gets Instagram's stacked-squares
badge, and the post detail view provides arrows, a slide counter (e.g. `2/3`), and
dots.

### 10.3 Reel

1. Set type to **Reel** and upload a video (MP4/WebM/MOV).
2. Upload a **cover image** — it is used for the grid tile and the Reels tab.
3. Save. The tile shows the reel badge; the **Reels tab** on the phone shows it as a
   tall 9:16 tile with a view count; the post detail renders the video with controls.

### 10.4 Editing and deleting posts

Open a post (click its grid tile) → **Edit post** reopens the composer with everything
in place, including media. **Delete post** (trash icon) asks for confirmation and
removes the post and its media everywhere.

### 10.5 Pinning posts

Toggle **Pin to profile** in the composer. Pinned posts always sort to the front of
the grid with Instagram's pin badge, exactly like the real app. At most **3** posts
can be pinned — the toggle disables itself when the limit is reached.

---

## 11. Reordering the grid

**Where:** workspace, **Edit mode**, Posts tab on the phone.

- **Mouse/touch:** drag any tile onto another tile; the drop target highlights, the
  order updates instantly and is saved.
- **Keyboard:** focus a tile (Tab) and press **Ctrl+Arrow** (left/up = earlier,
  right/down = later). Each tile announces these instructions to screen readers.
- Pinned posts always stay in front regardless of reordering.
- In **Preview mode** the grid is clean — no drag affordances.

The order is persisted (`gridPosition`) and survives refreshes and restarts.

## 12. Understanding post indicators

On grid tiles, top-right: **pin** (pinned post — takes precedence), **stacked
squares** (carousel), **reel glyph** (reel). On the Reels tab, tiles instead show a
play icon and view count bottom-left. In lists and cards throughout the app, colored
badges show **Draft / Scheduled / Published** and **Not sent / Awaiting approval /
Approved / Changes requested**.

## 13. Post detail

Click any grid tile. The phone shows Instagram's post screen: back arrow, author bar
(avatar, username, verified badge, location), the media (single, carousel with
arrows/dots/counter, or reel video), action row (like — tap to toggle, comment, share,
save), likes count, caption with highlighted hashtags, latest comments, timestamp
("Scheduled for …" for planned posts), and an add-comment field (your comments are
stored as creator feedback).

Outside the phone, creator-only panels show the post's status badges, **Edit post**,
**Delete**, the **Feedback** list (reviewer comments with **Mark resolved**), and
**Approval** actions (**Send for approval**, **Mark approved**). The URL is
deep-linkable and refresh-safe.

---

## 14. The content page

**Where:** `/content`.

Everything you've planned across all clients in one place.

- **Search** captions, hashtags, and client names.
- **Filters:** client, post type, status, approval state, and date (next 7 days /
  next 30 days / unscheduled). Filters combine; reset each to "All" to clear.
- **Views:** a visual grid or a compact table (list) — toggle top-right.
- **Row/tile actions:** open, edit (composer), delete (with confirmation).
- **Bulk actions:** tick the checkboxes → a bar appears with **Send for approval**,
  **Mark approved**, and **Delete** for the whole selection, plus "Clear selection".

## 15. Scheduling and the calendar

Two ways to schedule:

1. **In the composer** — toggle **Schedule**, pick date and time. The post's status
   becomes *Scheduled*.
2. **On the calendar** (`/calendar`) — drag any chip between days, or drag a draft up
   from the **Unscheduled drafts** tray onto a day (it gets 18:00 as a default time;
   rescheduling an already-scheduled post keeps its time of day).

Calendar features: month navigation with **Today**, a **client filter**, post-type
icons on each chip, and click-through to the post. All dates use **your local
timezone** — a post scheduled for 00:15 on the 1st stays on the 1st.

---

## 16. Sharing with a client

### Creating a share link

Workspace → **Share**. In the dialog:

- optionally set an **expiration date**;
- toggle **Allow comments** and **Allow approvals**;
- click **Create share link**.

Each link row shows its URL, created/expiry dates, permissions, a **copy** button, an
**open in new tab** button, **Disable/Enable**, and **Regenerate** (issues a new token
— the old URL stops working immediately).

### What the client sees

The public page (`/share/<token>`) shows a clean, full Instagram profile preview in
the client's chosen theme — no app chrome, no editing controls — plus a review panel:

1. They enter their **name and email** once (validated, remembered on their device).
2. Tapping a post opens Instagram's post detail inside the preview with a per-post
   panel: **Approve** (message optional), **Request changes** (message required), or
   **Comment only**.
3. From the grid view they can **Approve all pending** at once.

Invalid, disabled, and expired links each show a polished explanatory page.

### Managing all links

**Shared previews** (`/previews`) lists every link across clients with status
(Active / Disabled / Expired), created and expiry dates, comment count, approval
progress (`3/8 approved`), and the same copy/open/disable/regenerate actions.

---

## 17. Comments and approvals — the full loop

1. You mark posts **Awaiting approval** (per post, or in bulk on `/content`).
2. The client approves / requests changes / comments through their share link.
3. Every decision instantly updates: the **post's badge** everywhere, **dashboard
   counts** and **activity feed**, the **client card roll-up** (e.g. "Changes
   requested" wins over everything until resolved), the **content page**, and the
   **calendar** chips' underlying data.
4. You read feedback on the post detail page, **Mark resolved** handled comments, edit
   the content, and **Send for approval** again.

---

## 18. Settings

**Where:** `/settings`.

- **Your profile:** display name (shown in the sidebar and dashboard greeting); email
  is read-only.
- **Defaults:** default preview theme for new clients; default approval flow for new
  share links; your detected timezone (informational — scheduling always uses it).
- **Data:** a clear indicator of **demo mode** vs **Supabase (live)**. In demo mode:
  **Restore demo data** (replaces everything with the original three sample clients)
  and **Delete all data** (start from a truly empty workspace). Both ask for
  confirmation.
- **Session:** sign out.

---

## 19. Mobile usage

The whole app works on phones: the sidebar becomes a drawer, the workspace stacks the
phone preview above the editing panel, dialogs become bottom sheets, and the public
share page is designed mobile-first (clients will usually open it on their phone).
There is no horizontal scrolling anywhere; sticky headers (top bar, profile tabs)
behave like the native app.

---

## 20. Demo mode vs live mode

| | Demo mode | Live (Supabase) |
| --- | --- | --- |
| Account | none — one local demo user | real email/password accounts |
| Storage | your browser's IndexedDB | Postgres + Supabase Storage |
| Persistence | survives refresh/restart in the same browser profile | everywhere you sign in |
| Share links | resolve only against data in the opening browser (see below) | truly public URLs |
| Data reset | Settings → restore/wipe | manage in Supabase |

**The demo-mode share-link limitation, precisely:** demo data lives in the browser's
IndexedDB, which is per-profile and per-origin. A link you create works in your own
browser (any tab of the same profile). Another device, another browser profile, or an
incognito window has its own storage — your created link shows "Preview not found"
there. (The three *seeded* demo links do open in a fresh browser, because every fresh
browser recreates the same seed data — useful for exploring, but do not mistake it for
real sharing.) Connect Supabase for genuinely public preview links.

**Connecting Supabase:** copy `.env.example` → `.env.local`, fill in your project URL
and anon key, run `supabase/migrations/0001_init.sql` against the project, restart the
app.

---

## 21. Troubleshooting

- **"Loading workspace…" forever / sent to login unexpectedly** — your session ended;
  sign in or press *Continue in demo mode* again. Demo data is untouched.
- **A share link shows "Preview not found"** — in demo mode this is expected on other
  devices (see above). Otherwise the token was regenerated — copy the current link
  from *Shared previews*.
- **"Preview disabled" / "Preview expired"** — re-enable the link or create a new one.
- **An upload is rejected** — check the format (JPG/PNG/WEBP; video only for reels)
  and size (12 MB image / 25 MB video). The exact reason is shown next to the file.
- **My edits vanished** — profile edits must be saved with **Save profile**; the
  panel warns about unsaved changes.
- **I wiped my data by accident** — *Settings → Restore demo data* brings back the
  sample workspace; your own created content cannot be recovered after a wipe.
- **Port 3000 already in use when starting locally** — stop the old server process
  and run `npm start` again.

## 22. FAQ

**Does anything get published to Instagram?** No. The app is purely for planning and
approval.

**Can a client edit content?** No — reviewers can approve, request changes, and
comment. Only you can change content.

**How many posts can I pin?** Three, matching Instagram.

**Can I have several share links for one client?** Yes — e.g. one with approvals for
the client and a comment-only one for a colleague. Disable or regenerate them
independently.

**Where do "view counts" on reels come from?** They are display-only mock numbers to
make the preview feel real — the app plans content, it has no real Instagram metrics.

**Is the top-bar search functional?** Not yet — it's a visual placeholder in this
version (see Known Issues). Use the search fields on the Clients and Content pages.

**What are Reposts and Tagged tabs?** They render Instagram's tab structure for
fidelity; planned content currently populates Posts and Reels only.
