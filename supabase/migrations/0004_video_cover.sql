-- Video cover metadata. The cover image itself lives in the existing
-- post_media.thumbnail_url column (a separate image object in Storage —
-- the original video is never modified). These additive nullable columns
-- only record HOW the cover was produced so the editor can restore the
-- scheduler's selection after reload. Existing rows keep null (no cover
-- metadata) and are unaffected. RLS: post_media policies are row-level,
-- so the new columns inherit the existing owner/shared rules unchanged.

alter table post_media
  add column if not exists cover_source text
    check (cover_source in ('generated', 'frame', 'uploaded')),
  add column if not exists cover_timestamp double precision;
