-- 004: short SEO titles + IndexNow ping when a post goes live
--
-- A. blog_posts.seo_title — ≤60-character title used only for the <title> tag.
--    The H1, URL, og:title and RSS keep blog_posts.title.
--
-- B. IndexNow (Bing, Yandex, Seznam, Naver…) is told about a post once, when it
--    becomes live: status 'approved', not deleted, publish_at <= now().
--    * Live posts are pinged once (blog_posts.indexnow_pinged_at). Edits to a live
--      post never re-ping. If a post stops being live (unpublished, deleted) the
--      marker is cleared, so going live again counts as a new publish.
--    * Immediate cases (cron auto-publish, admin "publish now", restore) are caught by
--      an AFTER trigger. Posts approved early whose slot time simply arrives (no row
--      change) are caught by two cron runs one minute after each slot.
--    * Uses pg_net, which queues the HTTP request and returns at once, so a slow or
--      failing IndexNow can never delay or block publishing. Every attempt is logged
--      in blog_indexnow_log; HTTP results are visible in blog_indexnow_status.
--      Any error inside the ping is caught, logged and ignored.
--
-- Requires: pg_net (installed), pg_cron (installed).

-- ------------------------------------------------------------------ A. seo_title
alter table public.blog_posts add column if not exists seo_title text;
alter table public.blog_posts drop constraint if exists blog_posts_seo_title_len;
alter table public.blog_posts add constraint blog_posts_seo_title_len
  check (seo_title is null or char_length(btrim(seo_title)) between 10 and 60);

-- ------------------------------------------------------------------ B. IndexNow
alter table public.blog_posts add column if not exists indexnow_pinged_at timestamptz;

-- Existing live posts count as already announced (no burst of old URLs on deploy).
update public.blog_posts
   set indexnow_pinged_at = now()
 where status = 'approved' and deleted_at is null and publish_at <= now()
   and indexnow_pinged_at is null;

create table if not exists public.blog_indexnow_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  post_ids    uuid[] not null,
  urls        text[] not null,
  request_id  bigint,          -- pg_net request id; result in net._http_response
  error       text             -- set if queuing the request itself failed
);
alter table public.blog_indexnow_log enable row level security;
drop policy if exists blog_indexnow_log_admin_read on public.blog_indexnow_log;
create policy blog_indexnow_log_admin_read on public.blog_indexnow_log
  for select to authenticated using (public.blog_is_admin());

-- HTTP outcome of each ping (200/202 = accepted). pg_net keeps responses for a few hours.
create or replace view public.blog_indexnow_status
with (security_invoker = true) as
select l.id, l.created_at, l.urls, l.request_id, l.error,
       r.status_code, left(r.content, 200) as response, r.error_msg
from public.blog_indexnow_log l
left join net._http_response r on r.id = l.request_id;
revoke all on public.blog_indexnow_status from anon, authenticated;

-- Ping every live post that hasn't been announced yet. Never raises.
create or replace function public.blog_indexnow_ping_due()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids  uuid[];
  v_urls text[];
  v_req  bigint;
begin
  select array_agg(id), array_agg('https://kriosity.in/blog/' || slug)
    into v_ids, v_urls
    from public.blog_posts
   where status = 'approved' and deleted_at is null
     and publish_at <= now() and indexnow_pinged_at is null;

  if v_ids is null then
    return 0;
  end if;

  -- Mark first, so a failure can't cause repeated pings on every later run.
  update public.blog_posts set indexnow_pinged_at = now() where id = any (v_ids);

  v_urls := v_urls || array['https://kriosity.in/blog', 'https://kriosity.in/blog/sitemap.xml'];

  begin
    select net.http_post(
      url     := 'https://api.indexnow.org/indexnow',
      headers := '{"Content-Type": "application/json; charset=utf-8"}'::jsonb,
      body    := jsonb_build_object(
                   'host', 'kriosity.in',
                   'key', '8fce3a091e294eeefee37045f31b8431',
                   'keyLocation', 'https://kriosity.in/8fce3a091e294eeefee37045f31b8431.txt',
                   'urlList', to_jsonb(v_urls)),
      timeout_milliseconds := 10000
    ) into v_req;
    insert into public.blog_indexnow_log (post_ids, urls, request_id) values (v_ids, v_urls, v_req);
  exception when others then
    insert into public.blog_indexnow_log (post_ids, urls, error) values (v_ids, v_urls, sqlerrm);
  end;

  return array_length(v_ids, 1);
exception when others then
  -- Last-resort guard: never let IndexNow break the caller (publishing).
  raise warning 'blog_indexnow_ping_due failed: %', sqlerrm;
  return 0;
end $$;

revoke all on function public.blog_indexnow_ping_due() from public, anon, authenticated;

-- Clear the marker when a post stops being live, so a later re-publish pings again.
create or replace function public.blog_indexnow_reset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.indexnow_pinged_at is not null
     and not (new.status = 'approved' and new.deleted_at is null) then
    new.indexnow_pinged_at := null;
  end if;
  return new;
end $$;

drop trigger if exists blog_posts_indexnow_reset on public.blog_posts;
create trigger blog_posts_indexnow_reset before update on public.blog_posts
  for each row execute function public.blog_indexnow_reset();

-- Fire right away when a row becomes live (auto-publish, publish now, restore).
create or replace function public.blog_indexnow_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.blog_indexnow_ping_due();
  return null;
exception when others then
  raise warning 'blog_indexnow_after_change failed: %', sqlerrm;
  return null;
end $$;

drop trigger if exists blog_posts_indexnow_ping on public.blog_posts;
create trigger blog_posts_indexnow_ping after insert or update on public.blog_posts
  for each row
  when (new.status = 'approved' and new.deleted_at is null
        and new.publish_at <= now() and new.indexnow_pinged_at is null)
  execute function public.blog_indexnow_after_change();

-- Catch posts approved early whose slot time arrives with no row change.
-- 09:01 IST = 03:31 UTC, 18:01 IST = 12:31 UTC.
select cron.unschedule(jobid) from cron.job where jobname in ('blog-indexnow-morning', 'blog-indexnow-evening');
select cron.schedule('blog-indexnow-morning', '31 3 * * *',  $$select public.blog_indexnow_ping_due()$$);
select cron.schedule('blog-indexnow-evening', '31 12 * * *', $$select public.blog_indexnow_ping_due()$$);
