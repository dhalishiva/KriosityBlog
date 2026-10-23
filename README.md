# KriosityBlog

The blog at **https://kriosity.in/blog**: hands-on AI coverage (new models, comparisons, events,
guides, a weekly roundup) for developers, founders and IT teams, especially in India.

Posts are **drafted by an AI** (planned: every morning at 05:30 IST — see §10 for what is running today).
Each draft gets a fixed **slot** — morning (09:00 IST) or evening (18:00 IST) — and **posts automatically
at that slot unless the admin rejects it** in the admin app at **https://kriosity.in/blog/admin**.
Every post must list the sources its facts come from; the database enforces this, and a draft with no
sources never posts.

Owner: Shiva Dhali (Kriosity, Noida). This README is the handoff document: any developer or AI
assistant should be able to continue the project from it alone.

---

## 1. How it works

```
 05:30 IST  Drafting job (AI)                 Admin (Shiva), any time before the slot     09:00 / 18:00 IST  DB job
 ────────────────────────────                 ────────────────────────────────────────     ─────────────────────────
 reads pipeline/DRAFTING_PROMPT.md            kriosity.in/blog/admin (later: Android)     pg_cron → blog_publish_due()
 1. handles feedback (revising posts,         • read, comment, edit                       pending + due + has sources
    unhandled admin comments)                 • Reject  ← the only way to stop a post       → status 'approved'
 2. drafts 2 posts (Sun: 1 + roundup)         • Send back → Claude rewrites, new slot     (logged as auto_published)
 3. INSERT status='pending', slot,   ───────► • Approve early (optional)            ───►
    publish_at = today 09:00 / 18:00          • Change slot, delete, restore              kriosity.in/blog shows
                                                                                          status='approved' and
                                                                                          publish_at <= now()
```

**Slots.** morning = 09:00 IST, evening = 18:00 IST. The drafting job gives post 1 the morning slot and
post 2 the evening slot (Sundays: the weekly roundup takes the evening). The admin can move a post to
another date/slot, or publish it now.

**Publishing.** Two pg_cron jobs (`blog-publish-morning` 03:30 UTC, `blog-publish-evening` 12:30 UTC)
call `blog_publish_due()`, which flips every `pending` draft whose `publish_at` has passed and that has at
least one source to `approved`. Because each run only takes posts whose time has come, the 9 AM run picks
the morning post and the 6 PM run the evening post. Public pages re-render every 5 minutes (ISR), so a post
appears within ~5 minutes of its slot.

**Never auto-posted:** `rejected`, `revising` (sent back; gets a new slot after the rewrite), deleted, or no sources.

### Post lifecycle (`blog_posts.status`)

| status     | meaning                                                         | set by            |
|------------|-----------------------------------------------------------------|-------------------|
| `pending`  | drafted, has a slot; **will auto-post at the slot** unless rejected | drafting job      |
| `revising` | sent back for a rewrite (reject + "send back", or an `@Claude` comment); won't post | admin app |
| `approved` | approved early by the admin, or auto-published at its slot; live once `publish_at` passes | admin app / DB job |
| `rejected` | won't post (also used for "Unpublish"); admin can put it back in the queue with a new slot | admin app |
| `deleted_at` set | soft-deleted (any status); admin can restore or delete permanently | admin app |

## 2. Where things live

| Thing | Location |
|---|---|
| This repo | `github.com/dhalishiva/kriosityblog` |
| Main site (owns the domain) | `github.com/dhalishiva/kriosity` — its `next.config.ts` **rewrites `/blog` and `/blog/:path*` to this app's Vercel deployment** |
| Hosting | Vercel project **`kriosity-blog`** (this repo). Production URL behind the rewrite: see `BLOG_ORIGIN` in the main site's `next.config.ts` |
| Database | Supabase project **KriosityOps** (ref `xfskyegiwupjkuepiavx`, region ap-south-1). Blog tables are all prefixed `blog_` in `public`. They share the project with KriosityOps but have no links to its tables |
| Auth | Supabase Auth of the same project. Admin login: **shiva.dhali@kriosity.in**. That account is also a KriosityOps admin (KriosityOps' own `handle_new_user` trigger), which is expected |
| Drafting brief | `pipeline/DRAFTING_PROMPT.md` |
| Android review app | Not built yet. **Build spec: `docs/ANDROID_UI_KIT.md`** (tokens, components, screens, data mapping). UI kit (screens: sign in, queue, draft reader, reject sheet, comments, schedule, tokens/components) is a Claude Design canvas titled "Kriosity Blog Review App". It will use the same Supabase tables and RLS as the web admin |

## 3. Data model (`supabase/migrations/001_blog_schema.sql`)

- **`blog_posts`** — `slug` (unique, kebab-case), `title` (the H1), `seo_title` (≤60 chars, only for `<title>`), `summary`, `body_md` (Markdown, raw HTML is escaped on render),
  `category` (`news|new-model|comparison|event|guide|roundup`), `tags[]`, `status`, `slot` (`morning|evening`), `publish_at`,
  **`sources` jsonb** `[{title,url,publisher?,accessed_at?}]`, `fact_flags` jsonb `[{claim,note?}]`,
  `related_product` (`paidtwice|slotrecover|mahina|aegistra|kriosityops|beamdrop` or null),
  `reject_reasons[]`, `reject_note`, `reading_minutes`, `approved_at/by`, `deleted_at`, timestamps.
- **`blog_comments`** — threaded (`parent_id`), `author_kind` `admin|claude`, optional `anchor_text` (the quoted passage),
  `resolved`, `handled_at` (set by the drafting job once it acted on an admin comment).
- **`blog_post_events`** — audit trail of every action (`drafted, approved, auto_published, rejected, revision_requested, revised, slot_changed, requeued, edited, deleted, restored, unpublished, undo`).
- **`blog_subscribers`** — newsletter sign-ups from the blog pages.
- **`blog_admins`** — allowlist of admin emails (+ optional pinned `user_id`).

### Rules enforced in the database
- A source must be an object with a non-empty `title` and an `http(s)` `url` (`blog_posts_sources_shape`).
- **A post can't be `approved` without at least one source and a `publish_at`** (`blog_posts_approved_needs_sources`).
- RLS: the public (anon key) can only read live posts and insert subscribers. Everything else requires
  `blog_is_admin()` = signed in, email verified, email listed in `blog_admins`.
- The drafting job writes with the service role / SQL editor, which bypasses RLS.

### Search titles, descriptions and IndexNow
- `<title>`: `seo_title` if set, else `title`, via `postTitle()` in `lib/seo.ts`. The " | Kriosity Blog" suffix is kept only when the whole title fits in 70 characters; otherwise it's dropped, and a still-too-long title is cut at a natural break or whole word (no "…"). The H1, URL, og:title, twitter:title, JSON-LD and RSS always use the full `title`.
- Meta description: `summary`, cut to ≤160 characters the same way (`metaDescription()`); og:description keeps the full summary.
- IndexNow (migration 004): when a post becomes live, the database pings `api.indexnow.org` once with the post URL, `/blog` and `/blog/sitemap.xml`, using the kriosity.in key. It uses pg_net, so it never blocks publishing. `blog_posts.indexnow_pinged_at` marks posts already announced, and is cleared if a post stops being live. Attempts are logged in `blog_indexnow_log`; HTTP results are in the `blog_indexnow_status` view (SQL editor). Cron `blog-indexnow-morning/evening` (09:01 / 18:01 IST) catches posts approved early whose slot simply arrives.

## 4. Sourcing policy (non-negotiable)

Every fact taken from somewhere else — numbers, prices, benchmarks, dates, quotes, release details —
must be in the post's `sources`, and should also be linked inline where it's used. The site renders a
numbered **References** section from `sources` on every post (and adds them as `citation` in JSON-LD).
Unverified or single-source claims go in `fact_flags` so the admin sees them before approving.
Full rules: `pipeline/DRAFTING_PROMPT.md` §3.

## 5. App structure (Next.js 16, App Router, `basePath: "/blog"`)

```
app/
  layout.tsx              fonts (same as kriosity.in), metadata
  globals.css             public styles (kriosity.in palette) + admin styles (review-app UI kit)
  (site)/                 public blog
    layout.tsx            header/footer linking back to kriosity.in
    page.tsx              index + category filter + subscribe box
    [slug]/page.tsx       post page, References, product box, JSON-LD
  sitemap.ts              /blog/sitemap.xml (listed in kriosity.in robots.txt)
  rss.xml/route.ts        /blog/rss.xml
  admin/                  admin web app (client-side, Supabase JS + RLS), noindex
    layout.tsx            AdminShell: session + blog_is_admin() gate
    page.tsx              queue: Pending / Scheduled / Published / Rejected / Deleted
    posts/[id]/page.tsx   review: read, edit, sources editor, reject/send back, approve early, change slot,
                          delete/restore/permanent delete, comment threads, history
    subscribers/page.tsx  list, remove, CSV export
    account/page.tsx      set password, sign out
components/
  Subscribe.tsx
  admin/AdminShell.tsx, admin/Login.tsx
lib/
  supabase.ts             publicClient() for server, browserClient() for admin
  posts.ts                public queries
  admin.ts                event logging, queue buckets, status chips
  markdown.ts             markdown-it (html: false), external links open in new tab
  slots.ts                publishing slots 09:00 / 18:00 IST + IST date helpers
  site.ts                 site constants + product links/pitches
  types.ts                Post, Source, Comment, categories, reject reasons
pipeline/DRAFTING_PROMPT.md   brief for the drafting job
supabase/migrations/          schema (run in order on a fresh database)
supabase/move/                move the blog to another database (see §8)
```

## 6. Admin login

1. Go to **kriosity.in/blog/admin**.
2. First time: enter `shiva.dhali@kriosity.in` and press **Email me a sign-in code**. Enter the code
   (or tap the link in the email). This creates the account if it doesn't exist.
3. Under **Account**, set a password. From then on, email + password works.

To add another admin: `insert into blog_admins (email) values ('person@example.com');`
To lock an admin to one specific account after their first sign-in:
`update blog_admins set user_id = (select id from auth.users where email = 'shiva.dhali@kriosity.in') where email = 'shiva.dhali@kriosity.in';`

Supabase dashboard settings this relies on (Authentication → URL configuration):
add `https://kriosity.in/blog/admin` to **Redirect URLs** so the email link works. If the email
template doesn't include `{{ .Token }}`, only the link works (not the code) — both are fine.

## 7. Local development

```bash
cp .env.example .env.local     # fill in the anon/publishable key from Supabase → Project settings → API
npm install
npm run dev                    # http://localhost:3001/blog  and  /blog/admin
npm run build                  # must pass before pushing
```

Environment variables (set the same three in Vercel):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (= `https://kriosity.in`).
No server secrets are needed by the web app.

## 8. Moving the blog to its own database

Everything is self-contained in the `blog_` tables, so moving is copy-and-paste:

1. New Supabase project → SQL editor → run every file in `supabase/migrations/` in order (001, 002, …). 002 needs the pg_cron extension.
2. Old project (KriosityOps) → SQL editor → run `supabase/move/export_data.sql`. It returns one cell, `import_sql`.
3. Copy that cell, run it in the new project's SQL editor.
4. In Vercel, change `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, redeploy. Update the drafting job's project ref.
5. Sign in once on the new project (auth users aren't copied). Add the redirect URL from §6.
6. After checking the site, optionally run `supabase/move/drop_old.sql` on the old project.

For large data use the `pg_dump` command in the header of `export_data.sql`.

## 9. Conventions for whoever continues

- Keep the public site and the admin in this one app under `/blog`. Never link with a leading `/blog` inside `next/link` (basePath adds it); plain `<a>` tags need the full `/blog/...`.
- Schema changes: add `supabase/migrations/00N_description.sql` (idempotent: `if not exists`, `drop … if exists`), apply it to the database, and keep §3 of this README in sync.
- Keep every new table prefixed `blog_` and free of references to non-blog tables, so §8 keeps working.
- Never render post HTML without going through `lib/markdown.ts` (`html: false`).
- The web admin talks to Supabase directly with RLS; there are no API routes. The Android app should do the same.
- Product list for the end-of-post box lives in `lib/site.ts`; keep it in sync with `kriosity.in/products`.

## 10. Status and next steps

Live today (12 Oct 2026): public blog and admin app deployed at kriosity.in/blog.
**Not yet applied:** `supabase/migrations/001_blog_schema.sql` and `002_slots_autopublish.sql` still have to be run on the KriosityOps database; until then the blog shows its empty state and admin sign-in fails the admin check.
Not running yet: daily drafting, newsletter sending, Android app (see Next).

Built: schema + RLS (written), public blog (index, posts, references, categories, RSS, sitemap, subscribe),
admin web app (login, queue, review/edit, slots + auto-post unless rejected, reject/send back, comments, delete/restore,
subscribers, password), drafting brief, move scripts, `/blog` routing from kriosity.in.

Next:
- [ ] Daily drafting job as a scheduled task (05:30 IST) using `pipeline/DRAFTING_PROMPT.md`.
- [ ] Weekly newsletter send for `blog_subscribers` (Sunday roundup).
- [ ] Android review app per `docs/ANDROID_UI_KIT.md` (Kotlin/Compose or React Native), same Supabase tables; push notification when drafts arrive.
- [ ] Optional: cover images per post, Open Graph image generation.
