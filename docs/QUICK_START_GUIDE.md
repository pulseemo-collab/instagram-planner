# Quick Start Guide — Gridline Studio

Gridline Studio lets you plan a client's Instagram feed, preview it in a pixel-faithful
phone mock-up, share it with the client, and collect approvals — before anything is
published.

## 1. Run the app

```bash
npm install
npm run dev        # development server
# or
npm run build && npm start   # production build
```

Open **http://localhost:3000**.

## 2. Enter demo mode

You land on the sign-in page. Click **Continue in demo mode**.

Demo mode needs no account and no configuration. Everything you do is stored locally in
your browser (IndexedDB) and survives refreshes and restarts of the app. Three example
clients are pre-loaded so you can explore immediately.

## 3. Create your first client

1. Click **New client** (top-right, available on every page).
2. Enter the client/business name and their Instagram username.
3. Optionally upload a profile picture and pick light or dark preview theme.
4. Click **Create client** — you land directly in their workspace.

## 4. Add content (designer)

Open **Calendar**, pick the client, and click **Add content** in the **Content**
section. The dialog asks for exactly two things: a **content name** (e.g. *Post 1*)
and the **original media files** — one image, several images (one future carousel),
or a video. You can pick individual files, **drop a whole folder**, or use
**Choose folder**: subfolders are read recursively, unsupported and hidden system
files are skipped, and duplicates are never added twice. No captions, no
scheduling: the designer's job ends here. Files are stored **exactly as
uploaded** — original bytes, filename, quality.

## 5. Schedule & create the post (scheduler)

Drag a content card onto a calendar day — that attaches the **date only** (the chip
gets an amber dot: not a post yet). Click the placed item to open **Create post**:
media is loaded from the package, the date is pre-filled in **DD/MM/YYYY**, and the
**time is empty** for you to choose. Fill the caption and details, press
**Create post** — from then on it's a normal post (**Edit post / Save changes**),
editable beside the live Instagram preview. The **← Calendar** button always brings
you back with your client and month intact. Multiple items stack per day; drop a
chip back onto the Content section to unschedule. Dates use your local timezone.

## 6. Share with your client

In the workspace click **Share** → **Create share link** → **Copy link** and send it.
The client opens a clean Instagram-style preview — no account needed.

> **Demo-mode limitation:** demo data lives only in *your* browser, so a link you
> create in demo mode will not resolve on another person's machine. Connect Supabase
> (see `.env.example`) for genuinely public links.

## 7. Approvals

On the share page your client enters their name and email, then can **approve** posts,
**request changes** (message required), **comment**, or **Approve all pending**.
Every decision updates your dashboard counts, client cards, content page, and activity
feed immediately.

## 8. How persistence works

- **Demo mode:** IndexedDB in your browser. Refresh-safe. `Settings → Data` lets you
  restore the demo seed or wipe everything.
- **Live mode:** set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
  `.env.local`, apply every file in `supabase/migrations/` **in order** (0001 → 0010),
  and **rebuild** (`npm run build`), because the mode is fixed at build time. The same app
  then stores everything in Postgres + Supabase Storage with real accounts. For a
  project that's already in production, follow `docs/DEPLOY_GUIDE.md`.
