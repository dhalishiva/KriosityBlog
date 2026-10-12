-- KriosityBlog 002: fixed publishing slots + auto-publish unless rejected
--
-- Policy (decided by Shiva, 12 Oct 2026):
--   * Every draft is given a slot when it is drafted: 'morning' (09:00 IST) or 'evening' (18:00 IST),
--     stored as `slot`, with the exact time in `publish_at`.
--   * At 09:00 IST a job publishes the drafts that are due (the morning ones);
--     at 18:00 IST the same job publishes the evening ones.
--   * A draft is published automatically unless the admin REJECTED it. Approving early is optional.
--   * Never auto-published: rejected, sent back for a rewrite ('revising'), deleted, or with no sources.
--     A post sent back for a rewrite gets a new slot when Claude finishes the rewrite.
--
-- Requires the pg_cron extension (Supabase: Database → Extensions → pg_cron, or the line below).

-- ---------------------------------------------------------------- slot column
alter table public.blog_posts add column if not exists slot text
  check (slot in ('morning','evening'));

-- ---------------------------------------------------------------- publisher
create or replace function public.blog_publish_due()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with due as (
    update public.blog_posts
       set status = 'approved'
     where status = 'pending'
       and deleted_at is null
       and publish_at is not null
       and publish_at <= now()
       and jsonb_array_length(sources) >= 1
    returning id
  )
  insert into public.blog_post_events (post_id, action, actor, note)
  select id, 'auto_published', 'system', 'not rejected by slot time'
  from due;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.blog_publish_due() from public, anon, authenticated;

-- ---------------------------------------------------------------- schedule (times are UTC)
create extension if not exists pg_cron;

-- 09:00 IST = 03:30 UTC, 18:00 IST = 12:30 UTC
select cron.unschedule(jobid) from cron.job where jobname in ('blog-publish-morning', 'blog-publish-evening');
select cron.schedule('blog-publish-morning', '30 3 * * *',  $$select public.blog_publish_due()$$);
select cron.schedule('blog-publish-evening', '30 12 * * *', $$select public.blog_publish_due()$$);
