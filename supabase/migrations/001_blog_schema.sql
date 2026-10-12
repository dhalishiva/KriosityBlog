-- KriosityBlog schema
-- Every object is prefixed blog_ and lives in the public schema, so the whole
-- blog can be moved to another Supabase project with supabase/move/ (see README).
-- Nothing here references KriosityOps tables. User ids are stored without a
-- foreign key to auth.users so the data survives a move.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- admins
create table if not exists public.blog_admins (
  email      text primary key check (email = lower(email)),
  user_id    uuid unique,            -- pinned after first sign-in (optional but safer)
  created_at timestamptz not null default now()
);

insert into public.blog_admins (email) values ('shiva.dhali@kriosity.in')
on conflict (email) do nothing;

-- True when the caller is a signed-in, email-verified blog admin.
create or replace function public.blog_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.blog_admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and (a.user_id is null or a.user_id = u.id)
  );
$$;

-- ---------------------------------------------------------------- posts
create table if not exists public.blog_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null check (length(title) between 10 and 160),
  summary          text,                                   -- 1–2 sentence dek, used for SEO description
  body_md          text not null,                          -- Markdown; NO references section, those come from `sources`
  category         text not null default 'news'
                   check (category in ('news','new-model','comparison','event','guide','roundup')),
  tags             text[] not null default '{}',
  status           text not null default 'pending'
                   check (status in ('pending','revising','approved','rejected')),
  publish_at       timestamptz,                            -- live on the site once approved and publish_at <= now()
  sources          jsonb not null default '[]'::jsonb,     -- [{ "title","url","publisher","accessed_at" }]
  fact_flags       jsonb not null default '[]'::jsonb,     -- [{ "claim","note" }] claims the drafter could not double-source
  related_product  text,                                   -- e.g. 'paidtwice', 'slotrecover', 'mahina'
  cover_image_url  text,
  reading_minutes  int,
  reject_reasons   text[] not null default '{}',
  reject_note      text,
  drafted_by       text not null default 'claude',
  approved_at      timestamptz,
  approved_by      uuid,
  deleted_at       timestamptz,                            -- soft delete; hard delete is also allowed for admins
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists blog_posts_public_idx on public.blog_posts (publish_at desc)
  where status = 'approved' and deleted_at is null;
create index if not exists blog_posts_status_idx on public.blog_posts (status, created_at desc);

-- Every source must be an object with an http(s) url and a title.
create or replace function public.blog_sources_valid(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(s) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e->>'url','') !~ '^https?://'
          or coalesce(e->>'title','') = ''
     );
$$;

alter table public.blog_posts drop constraint if exists blog_posts_sources_shape;
alter table public.blog_posts add constraint blog_posts_sources_shape
  check (public.blog_sources_valid(sources));

-- A post can only be approved (and therefore go live) with at least one reference.
alter table public.blog_posts drop constraint if exists blog_posts_approved_needs_sources;
alter table public.blog_posts add constraint blog_posts_approved_needs_sources
  check (status <> 'approved' or (jsonb_array_length(sources) >= 1 and publish_at is not null));

create or replace function public.blog_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.approved_at := now();
    new.approved_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch before insert or update on public.blog_posts
  for each row execute function public.blog_touch();

-- ---------------------------------------------------------------- comments
create table if not exists public.blog_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.blog_posts(id) on delete cascade,
  parent_id    uuid references public.blog_comments(id) on delete cascade,
  author_kind  text not null check (author_kind in ('admin','claude')),
  author_id    uuid,
  body         text not null check (length(body) between 1 and 4000),
  anchor_text  text,              -- quoted passage the comment is about (null = whole post)
  resolved     boolean not null default false,
  handled_at   timestamptz,       -- set by the drafting job once Claude has acted on it
  created_at   timestamptz not null default now()
);
create index if not exists blog_comments_post_idx on public.blog_comments (post_id, created_at);
create index if not exists blog_comments_parent_idx on public.blog_comments (parent_id);

-- ---------------------------------------------------------------- audit trail
create table if not exists public.blog_post_events (
  id         bigint generated always as identity primary key,
  post_id    uuid references public.blog_posts(id) on delete set null,
  action     text not null,       -- drafted, approved, rejected, revision_requested, revised, deleted, edited
  actor      text not null,       -- 'admin:<email>' or 'claude'
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists blog_post_events_post_idx on public.blog_post_events (post_id, created_at);

-- ---------------------------------------------------------------- newsletter
create table if not exists public.blog_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  source     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table public.blog_admins      enable row level security;
alter table public.blog_posts       enable row level security;
alter table public.blog_comments    enable row level security;
alter table public.blog_post_events enable row level security;
alter table public.blog_subscribers enable row level security;

drop policy if exists blog_admins_admin_read on public.blog_admins;
create policy blog_admins_admin_read on public.blog_admins
  for select to authenticated using (public.blog_is_admin());

drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts
  for select to anon, authenticated
  using (status = 'approved' and deleted_at is null and publish_at <= now());

drop policy if exists blog_posts_admin_all on public.blog_posts;
create policy blog_posts_admin_all on public.blog_posts
  for all to authenticated
  using (public.blog_is_admin()) with check (public.blog_is_admin());

drop policy if exists blog_comments_admin_all on public.blog_comments;
create policy blog_comments_admin_all on public.blog_comments
  for all to authenticated
  using (public.blog_is_admin()) with check (public.blog_is_admin());

drop policy if exists blog_events_admin_all on public.blog_post_events;
create policy blog_events_admin_all on public.blog_post_events
  for all to authenticated
  using (public.blog_is_admin()) with check (public.blog_is_admin());

drop policy if exists blog_subscribers_public_insert on public.blog_subscribers;
create policy blog_subscribers_public_insert on public.blog_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists blog_subscribers_admin_read on public.blog_subscribers;
create policy blog_subscribers_admin_read on public.blog_subscribers
  for select to authenticated using (public.blog_is_admin());

drop policy if exists blog_subscribers_admin_delete on public.blog_subscribers;
create policy blog_subscribers_admin_delete on public.blog_subscribers
  for delete to authenticated using (public.blog_is_admin());

revoke all on function public.blog_is_admin() from public;
grant execute on function public.blog_is_admin() to anon, authenticated;
