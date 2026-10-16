-- 003: comments from a signed-in admin don't have to send author fields.
-- (16 Oct 2026: the Android app inserted comments without author_kind and got a NOT NULL error.)
-- The drafting job writes with the service role and sets author_kind = 'claude' explicitly.
alter table public.blog_comments alter column author_kind set default 'admin';
alter table public.blog_comments alter column author_id set default auth.uid();
