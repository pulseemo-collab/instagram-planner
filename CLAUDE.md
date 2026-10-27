@AGENTS.md

# Project rules (apply to every task)

- **Migrations are backward-compatible with the code in production.** Every
  database migration must work with the app that is live right now, so it
  can be applied BEFORE the new code deploys without breaking anything. Add
  new things first; remove or rename old ones only in a later migration,
  once the code no longer uses them.
- **Deploy procedure (the only one):** (1) if there is a migration, run it in
  the Supabase SQL Editor; (2) `git push origin main` — Vercel auto-deploys.
  Never ask to toggle Vercel settings or promote deployments.
- **End every task with a short "How to deploy" section:** either
  "No migration — just push" or "Run supabase/migrations/XXXX.sql in the SQL
  Editor, then push".
