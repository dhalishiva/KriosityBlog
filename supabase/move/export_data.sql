-- ============================================================================
-- KriosityBlog: copy all blog data to another Supabase / Postgres database
-- ============================================================================
-- STEP 1  In the NEW database, run supabase/migrations/001_blog_schema.sql.
--         That creates empty blog_ tables, policies and functions.
--
-- STEP 2  In the OLD database (today: KriosityOps project, ref xfskyegiwupjkuepiavx),
--         run THIS file in the SQL editor. It returns ONE row with ONE column,
--         `import_sql`, containing a ready-to-run script with all the blog data.
--
-- STEP 3  Copy that cell and run it in the NEW database's SQL editor.
--
-- STEP 4  Point the app at the new project: change NEXT_PUBLIC_SUPABASE_URL and
--         NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel (project kriosity-blog), redeploy.
--         Admins sign in again in the new project (auth users are not copied;
--         blog_admins.user_id is reset so the first verified sign-in works).
--
-- STEP 5  Once the new site is confirmed working, optionally drop the old tables
--         with supabase/move/drop_old.sql in the OLD database.
--
-- Notes
-- * Uses jsonb_populate_recordset, so column order doesn't matter and values
--   keep their exact types (uuid, timestamptz, jsonb, text[]).
-- * Safe to re-run in the new DB: rows that already exist are skipped.
-- * For very large data (cell too big to copy, roughly >10 MB) use pg_dump instead:
--     pg_dump "$OLD_DB_URL" --data-only --no-owner \
--       -t public.blog_admins -t public.blog_posts -t public.blog_comments \
--       -t public.blog_post_events -t public.blog_subscribers > blog_data.sql
--     psql "$NEW_DB_URL" -f blog_data.sql
-- ============================================================================

select
  'begin;' || E'\n'

  || 'insert into public.blog_admins select * from jsonb_populate_recordset(null::public.blog_admins, '
  || quote_literal(coalesce((select jsonb_agg(to_jsonb(a) - 'user_id') from public.blog_admins a), '[]'::jsonb)::text)
  || ') on conflict do nothing;' || E'\n'

  || 'alter table public.blog_posts disable trigger blog_posts_touch;' || E'\n'
  || 'insert into public.blog_posts select * from jsonb_populate_recordset(null::public.blog_posts, '
  || quote_literal(coalesce((select jsonb_agg(to_jsonb(p)) from public.blog_posts p), '[]'::jsonb)::text)
  || ') on conflict do nothing;' || E'\n'
  || 'alter table public.blog_posts enable trigger blog_posts_touch;' || E'\n'

  || 'insert into public.blog_comments select * from jsonb_populate_recordset(null::public.blog_comments, '
  || quote_literal(coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.blog_comments c), '[]'::jsonb)::text)
  || ') on conflict do nothing;' || E'\n'

  || 'insert into public.blog_post_events overriding system value select * from jsonb_populate_recordset(null::public.blog_post_events, '
  || quote_literal(coalesce((select jsonb_agg(to_jsonb(e)) from public.blog_post_events e), '[]'::jsonb)::text)
  || ') on conflict do nothing;' || E'\n'
  || 'select setval(pg_get_serial_sequence(''public.blog_post_events'',''id''), coalesce((select max(id) from public.blog_post_events), 1));' || E'\n'

  || 'insert into public.blog_subscribers select * from jsonb_populate_recordset(null::public.blog_subscribers, '
  || quote_literal(coalesce((select jsonb_agg(to_jsonb(s)) from public.blog_subscribers s), '[]'::jsonb)::text)
  || ') on conflict do nothing;' || E'\n'

  || 'commit;' || E'\n'
  || '-- rows: posts ' || (select count(*) from public.blog_posts)
  || ', comments ' || (select count(*) from public.blog_comments)
  || ', events ' || (select count(*) from public.blog_post_events)
  || ', subscribers ' || (select count(*) from public.blog_subscribers)
  as import_sql;
