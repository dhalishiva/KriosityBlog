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
