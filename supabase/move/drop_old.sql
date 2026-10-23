-- Run in the OLD database ONLY after the blog works from the new one.
-- Removes every blog_ object. Irreversible.
drop table if exists public.blog_post_events cascade;
drop table if exists public.blog_comments cascade;
drop table if exists public.blog_posts cascade;
drop table if exists public.blog_subscribers cascade;
drop table if exists public.blog_admins cascade;
drop function if exists public.blog_is_admin();
drop function if exists public.blog_sources_valid(jsonb);
drop function if exists public.blog_touch();
drop function if exists public.blog_publish_due();
select cron.unschedule(jobid) from cron.job where jobname in ('blog-publish-morning', 'blog-publish-evening');
drop trigger if exists blog_posts_indexnow_ping on public.blog_posts;
drop trigger if exists blog_posts_indexnow_reset on public.blog_posts;
drop view if exists public.blog_indexnow_status;
drop table if exists public.blog_indexnow_log cascade;
drop function if exists public.blog_indexnow_after_change();
drop function if exists public.blog_indexnow_reset();
drop function if exists public.blog_indexnow_ping_due();
select cron.unschedule(jobid) from cron.job where jobname in ('blog-indexnow-morning', 'blog-indexnow-evening');
