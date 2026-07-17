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

## 4. Add posts

In the client workspace, open the **Posts** panel tab and click **New post**.

- Drop one image for a **single post**, several for a **carousel**, or switch the type
  to **Reel** and upload a video plus a cover image.
- Add the caption, hashtags, location, and alt text.
- Save — the post appears instantly in the Instagram grid. Drag tiles (or focus a tile
  and press **Ctrl+Arrow**) to rearrange the feed.

## 5. Schedule

Either edit a post and switch on **Schedule** with a date and time, or open
**Calendar** and drag any unscheduled draft onto a day. Dates always use your local
timezone.

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
  `.env.local`, run `supabase/migrations/0001_init.sql` on your project, and the same
  app stores everything in Postgres + Supabase Storage with real accounts.
