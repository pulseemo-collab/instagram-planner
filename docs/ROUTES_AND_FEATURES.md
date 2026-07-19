# Routes & Features Inventory — Gridline Studio

Access levels: **Public** (no session), **Session** (demo session or Supabase login),
**Reviewer** (valid share token, no account).

| Route | Purpose | Access | Main actions | Data source | Demo | Live |
| --- | --- | --- | --- | --- | --- | --- |
| `/login` | Sign in / demo entry | Public | Email+password sign-in (live), "Continue in demo mode" | Supabase Auth or localStorage flag | ✅ | ✅ |
| `/signup` | Account creation | Public | Name/email/password signup, demo entry | Supabase Auth | button shown, explains demo | ✅ |
| `/` | Overview dashboard | Session | Read stats, open clients/posts, New client | Derived live from workspace snapshot | ✅ | ✅ |
| `/clients` | Client management | Session | Search, approval filter, sort, create, edit, duplicate, delete | Repository (`clients`, `posts`) | ✅ | ✅ |
| `/clients?new=1` | Create-client dialog auto-open | Session | Same as New client button | — | ✅ | ✅ |
| `/clients/[clientId]` | Instagram workspace | Session | Edit/preview modes, profile editing (all fields, live), highlights CRUD + reorder, new post, grid drag/keyboard reorder, share dialog, duplicate/delete client | Repository bundle for the client | ✅ | ✅ |
| `/clients/[clientId]/posts/[postId]` | Post detail: phone preview + **direct inline editor** | Session | **Create post** on first open of placed content (date pre-filled DD/MM/YYYY, time empty and required) → **Edit post / Save changes** afterwards; full always-visible form with live preview, delete; `?from=calendar` shows a ← Calendar back button preserving client + month | Repository (`posts`, `post_media`, `comments`) | ✅ | ✅ |
| `/content` | Cross-client library | Session | Search, 5 filters, grid/list views, edit, delete, bulk select, bulk approval, bulk delete, new post | Repository (all posts) | ✅ | ✅ |
| `/calendar` | **Main planning workspace** (single client, Content → Post) | Session | Client picker + persisted switcher (no "all clients"), month nav (persisted per session), Content section with minimal **Add content** dialog (name + original media only) and All/Unscheduled/Scheduled filters, drag content → day (date only, DD/MM/YYYY), chips between days, drop-to-unschedule, date-only Schedule dialog (touch/keyboard) | Repository (`posts.stage` content/post; selection in localStorage, month in sessionStorage) | ✅ | ✅ |
| `/previews` | Share-link management | Session | Copy, open, disable/enable, regenerate token; status/comment/approval overview | Repository (`share_links` + derived) | ✅ | ✅ |
| `/settings` | User & data settings | Session | Display name, default theme, approval defaults, timezone display, mode indicator, restore/wipe demo data, sign out | Repository (`profiles`) + localStorage prefs | ✅ | ✅ (wipe/restore demo-only) |
| `/preview` | Design playground (static sample profile) | Session | Light/dark toggle on a fixed sample profile | Static sample data | ✅ | ✅ |
| `/share/[shareToken]` | Public client review page | Reviewer | View profile + posts, name/email form, approve, request changes, comment, approve all | Token-scoped repository access | ✅ (same-browser only) | ✅ (truly public) |
| `/share/<invalid>` | Error state | Public | Polished "Preview not found / disabled / expired" screens | — | ✅ | ✅ |

## Feature inventory

- **Modes / roles:** demo user (localStorage session + IndexedDB data), authenticated
  Supabase user (proxy-protected routes, Postgres/Storage data), public reviewer
  (share token). Mode switch is automatic from env configuration
  (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` present → live).
- **Instagram fidelity layer:** reusable components under `src/components/instagram/`
  render profile (top bar, header w/ story ring + note bubble, stats, bio + threads
  badge + verified seal, action buttons, highlights, tabs, 3-col grid w/
  pinned/carousel/reel badges, bottom nav) and post detail (author bar, media viewer,
  carousel dots/arrows, actions, likes, caption, comments, timestamp, add-comment).
- **Grid engine:** pinned-first ordering, HTML5 drag reorder, Ctrl+Arrow keyboard
  reorder, persisted `gridPosition`, 3:4 tiles (9:16 on Reels tab).
- **Uploads:** drag-drop + picker, multi-file, JPG/PNG/WEBP (+ MP4/WebM/MOV for
  reels), size/type validation, progress, retry, remove-before-save. Demo = data URLs
  in IndexedDB; live = Supabase Storage buckets `avatars`, `highlights`, `post-media`.
  The calendar's **Add content** dropzone additionally accepts **folders** (drop or
  Choose folder / `webkitdirectory`): recursive import in path order, hidden/system
  files ignored, unsupported files skipped with an announced summary, exact
  duplicates prevented — the folder itself is never stored.
- **Approvals:** per-post approve / changes-requested / comment, approve-all, resolve
  comments, roll-ups on dashboard cards and client list, activity records.
- **Feature flags:** none. The only behavioral switch is Supabase env presence.
