# KriosityBlog

The blog at **https://kriosity.in/blog**: hands-on AI coverage (new models, comparisons, events,
guides, a weekly roundup) for developers, founders and IT teams, especially in India.

Posts are **drafted by an AI** (planned: every morning at 05:30 IST — see §10 for what is running today) and **published only after a human
approves them** in the admin app at **https://kriosity.in/blog/admin**. Every post must list the
sources its facts come from; the database enforces this.

Owner: Shiva Dhali (Kriosity, Noida). This README is the handoff document: any developer or AI
assistant should be able to continue the project from it alone.

---

## 1. How it works

```
 05:30 IST  Drafting job (AI)                    Admin (Shiva)                         Public
 ─────────────────────────────                    ──────────────────────────            ─────────────────
 reads pipeline/DRAFTING_PROMPT.md                kriosity.in/blog/admin                kriosity.in/blog
 1. handles feedback (revising posts,             (later: Android app, same API)
    unhandled admin comments)                     • Pending → read, comment
 2. researches 2 topics (+ Sunday roundup)        • Approve → pick slot (9 AM / 6 PM)   shows posts where
 3. INSERT blog_posts status='pending'  ───────►  • Reject / send back for rewrite  ──► status='approved'
    with sources[] and fact_flags[]               • Edit, delete, restore                and publish_at <= now()
                                                  • Subscribers list / CSV
```

There is **no publish cron**. A post is live when `status = 'approved'` and `publish_at <= now()`.
Public pages re-render every 5 minutes (ISR), so a post appears within ~5 minutes of its slot.

### Post lifecycle (`blog_posts.status`)

| status     | meaning                                                         | set by            |
|------------|-----------------------------------------------------------------|-------------------|
| `pending`  | waiting for admin review                                        | drafting job      |
| `revising` | admin sent it back (reject + "send back", or an `@Claude` comment) | admin app         |
| `approved` | scheduled; live once `publish_at` passes                        | admin app         |
| `rejected` | dropped                                                         | admin app         |
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

- **`blog_posts`** — `slug` (unique, kebab-case), `title`, `summary`, `body_md` (Markdown, raw HTML is escaped on render),
  `category` (`news|new-model|comparison|event|guide|roundup`), `tags[]`, `status`, `publish_at`,
  **`sources` jsonb** `[{title,url,publisher?,accessed_at?}]`, `fact_flags` jsonb `[{claim,note?}]`,
  `related_product` (`paidtwice|slotrecover|mahina|aegistra|kriosityops|beamdrop` or null),
  `reject_reasons[]`, `reject_note`, `reading_minutes`, `approved_at/by`, `deleted_at`, timestamps.
- **`blog_comments`** — threaded (`parent_id`), `author_kind` `admin|claude`, optional `anchor_text` (the quoted passage),
  `resolved`, `handled_at` (set by the drafting job once it acted on an admin comment).
- **`blog_post_events`** — audit trail of every action (`drafted, approved, rejected, revision_requested, revised, edited, deleted, restored, unpublished, undo`).
- **`blog_subscribers`** — newsletter sign-ups from the blog pages.
- **`blog_admins`** — allowlist of admin emails (+ optional pinned `user_id`).

### Rules enforced in the database
- A source must be an object with a non-empty `title` and an `http(s)` `url` (`blog_posts_sources_shape`).
- **A post can't be `approved` without at least one source and a `publish_at`** (`blog_posts_approved_needs_sources`).
- RLS: the public (anon key) can only read live posts and insert subscribers. Everything else requires
  `blog_is_admin()` = signed in, email verified, email listed in `blog_admins`.
- The drafting job writes with the service role / SQL editor, which bypasses RLS.

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
    posts/[id]/page.tsx   review: read, edit, sources editor, approve (slot picker), reject/send back,
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

1. New Supabase project → SQL editor → run `supabase/migrations/001_blog_schema.sql`.
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
**Not yet applied:** the schema in `supabase/migrations/001_blog_schema.sql` still has to be run on the KriosityOps database; until then the blog shows its empty state and admin sign-in fails the admin check.
Not running yet: daily drafting, newsletter sending, Android app (see Next).

Built: schema + RLS (written), public blog (index, posts, references, categories, RSS, sitemap, subscribe),
admin web app (login, queue, review/edit, approve with slot, reject/send back, comments, delete/restore,
subscribers, password), drafting brief, move scripts, `/blog` routing from kriosity.in.

Next:
- [ ] Daily drafting job as a scheduled task (05:30 IST) using `pipeline/DRAFTING_PROMPT.md`.
- [ ] Weekly newsletter send for `blog_subscribers` (Sunday roundup).
- [ ] Android review app per `docs/ANDROID_UI_KIT.md` (Kotlin/Compose or React Native), same Supabase tables; push notification when drafts arrive.
- [ ] Optional: cover images per post, Open Graph image generation.
