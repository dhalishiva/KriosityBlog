# Kriosity Blog — Android review app: UI kit & build spec

This document is everything needed to build the Android app that Shiva (the admin) uses to
review AI-drafted blog posts before they go live on **kriosity.in/blog**. Hand it to any
developer or AI coding assistant together with the repo's main `README.md` (system overview,
database, rules).

The visual reference is a Claude Design canvas titled **"Kriosity Blog Review App"** (7 artboards,
private to Shiva — ask him for a screenshot export if you can't open it). Everything on that canvas is
written out below, so this file alone is enough to build from.

The web admin at `kriosity.in/blog/admin` (`app/admin/` in this repo) already implements every flow
below against the same database. **When in doubt, match the web admin's behaviour.**

---

## 1. What the app does

1. Sign in (admin only).
2. See the queue of drafts waiting for review.
3. Read a draft, its sources and any fact-check flags.
4. Approve it into a publishing slot, or reject / send it back to Claude for a rewrite.
5. Comment on a passage or the whole post, reply, resolve; `@Claude` asks for a change.
6. See the publishing schedule; undo recent actions.
7. Edit, delete, restore posts (secondary; can link out to the web admin in v1).

The app **never** publishes by itself. A post goes live when `status = 'approved'` and
`publish_at <= now()`; the public site picks it up within ~5 minutes.

## 2. Tech recommendation

- **Kotlin + Jetpack Compose**, Material 3 as the base, restyled with the tokens below
  (don't ship default Material purple). Min SDK 26.
- **Supabase Kotlin client** (`io.github.jan-tennert.supabase`: `auth-kt`, `postgrest-kt`, optionally `realtime-kt`).
- No backend of our own: the app talks to Supabase directly. Row Level Security already limits
  everything to admins (see README §3). Only the **publishable/anon key** goes in the app; never a service key.
- React Native / Expo is acceptable if preferred; the spec is framework-neutral.

Config (same values as the web app, see `.env.example`):
```
SUPABASE_URL = https://xfskyegiwupjkuepiavx.supabase.co
SUPABASE_ANON_KEY = <publishable key from Supabase → Project settings → API>
```

## 3. Design tokens

### Colour
| Token | Hex | Use |
|---|---|---|
| ink | `#12131A` | primary text, dark surfaces (sign-in top, summary banner, snackbar), selected chips |
| indigo | `#3340C4` | primary actions, links, active tab underline, active nav |
| indigo-dark | `#232D96` | pressed primary |
| indigo-soft | `#E8EAFB` | category chips, active nav pill, Claude avatar |
| indigo-on-dark | `#AEB6FF` | links/UNDO on dark surfaces, overline on sign-in |
| ground | `#F3F4F6` | screen background behind cards |
| surface | `#FFFFFF` | cards, sheets, app bars |
| line | `#E3E5EA` | card borders, dividers |
| line-strong | `#C6C9D2` | input and secondary button borders |
| muted | `#5B5F6B` | meta text, inactive tabs/nav |
| body | `#4A4E5A` | secondary paragraph text, field labels |
| pending bg / fg | `#FEF3C7` / `#92400E` | "Needs review", "Claude revising" chips |
| approved bg / fg | `#E7F5EC` / `#166534` | "Scheduled" chip, Resolve button |
| rejected bg / fg | `#FDECEC` / `#991B1B` | "Rejected" chip |
| danger | `#B91C1C` | destructive buttons (Reject confirm, Delete) |
| flag bg / border / title / text | `#FFF7E6` / `#F5D9A0` / `#7C2D12` / `#6B4A12` | fact-check banner, quoted passage in comments |
| flag icon | `#B45309` | "2 flags" meta |
| ok icon | `#15803D` | "Facts checked" meta, success dot on timeline |

Text on every fill meets WCAG AA (4.5:1). Don't put white text on the soft colours.

### Type
- **UI:** Schibsted Grotesk (Google Fonts) 400/500/600/700.
- **Post content** (titles of posts, reading view, quotes): Newsreader (Google Fonts) 400/600.
- **Logo wordmark:** Bricolage Grotesque 600, width axis 90, letter-spacing −3.5%.

| Style | Font | Size/line | Weight |
|---|---|---|---|
| Screen title | Schibsted | 26/32 | 700 |
| Post title (reader) | Newsreader | 28/33 | 600 |
| Post title (card) | Newsreader | 21/26 | 600 |
| Reading body | Newsreader | 18/29 | 400 |
| Sheet title | Schibsted | 22/28 | 700 |
| Body / list | Schibsted | 15/22 | 400–500 |
| Label | Schibsted | 13/18 | 600 |
| Meta | Schibsted | 13/18 | 400, muted |
| Chip | Schibsted | 12/16 | 600 |
| Overline | Schibsted | 12–13 | 600, uppercase, +8% tracking |

### Shape & spacing
- 8 dp grid. Screen padding 16–20 dp. Card padding 16 dp. Gaps 10–12 dp between cards.
- Radius: cards 16, buttons 14, inputs 12–14, sheets 24 (top corners), chips full, dark banners 16.
- Touch targets ≥ 44 dp (48 dp preferred). Primary buttons 52 dp high.
- Borders 1 dp (cards), 1.5 dp (inputs, secondary buttons). No drop shadows except the bottom sheet scrim.
- Icons: 2 dp stroke line icons (Lucide or Material Symbols *Outlined* at weight 400), 20–22 dp.

### Logo
The Kriosity crystal mark + lowercase wordmark "kriosity". Mark SVG (32×32 viewBox):
```svg
<svg viewBox="0 0 32 32"><polygon points="16,1 6,11 16,13" fill="#0377B5"/><polygon points="16,1 26,11 16,13" fill="#4A51DC"/><polygon points="6,11 16,13 16,31" fill="#C2362B"/><polygon points="26,11 16,13 16,31" fill="#0F7B6C"/><polygon points="6,11 16,31 3,14" fill="#9DB8F7"/><polygon points="26,11 16,31 29,14" fill="#2C64F0"/></svg>
```
Same file as `app/icon.svg`. Use it as an Android vector drawable and as the adaptive launcher icon
(mark centred on white, or on `#12131A` for the dark variant). Never redraw or recolour it.
Lockups: mark + "kriosity" (sign-in, white on ink); mark + "kriosity" + divider + "blog admin" (queue header).

## 4. Components

- **Status chip** — pill, 12 sp/600, 4×10 dp padding. Variants: category (indigo-soft/indigo), Needs review & Claude revising (pending), Scheduled (approved), Published (ink bg, white text), Rejected (rejected), Deleted (`#EEF0F3` / body).
- **Draft card** — surface, 1 dp line border, radius 16, padding 16. Row 1: category chip, status chip, time on the right (muted 12 sp). Title (Newsreader 21). Optional summary (14/20, body colour, max 2 lines). Meta row: link icon + "N sources", clock + "N min read", then either amber triangle "N flags", green check "Facts checked", or amber "No sources — can't be approved". Whole card taps to the reader.
- **Summary banner** — ink, radius 16: "Today, Mon 12 Oct" (13, `#C9CBD3`) over "N drafts waiting for you" (17/600, white); right: indigo pill "Next slot 6:00 PM".
- **Tabs** — text tabs with 3 dp indigo underline on the active one; inactive muted 500. Labels include counts: "Pending 2".
- **Bottom navigation** — 4 items: Queue, Schedule, Comments, Stats. Active item has a 56×30 indigo-soft pill behind the icon and indigo label; others muted.
- **Buttons** — Primary (indigo fill, white), Secondary (white, 1.5 dp line-strong border, ink text), Destructive (danger fill), Text (indigo, no border), Icon (44 dp circle, transparent).
- **Fact-check banner** — flag bg + border, radius 12, triangle icon, title "2 claims need a second look", then one line per flag.
- **Selectable chip** (reject reasons, filters) — 40 dp high pill; off: white + line-strong border; on: ink fill, white text, leading check icon.
- **Toggle row** — ground fill, radius 12, title + helper text left, switch right (indigo when on).
- **Comment thread** — card; optional quoted passage (flag-bg box, Newsreader 15); messages with 32 dp avatar (Shiva: ink circle "S"; Claude: indigo-soft circle with sparkle icon), name 14/700 + time 12 muted, body 15. Replies indented with a 2 dp line on the left. Actions: Reply (secondary), Resolve (approved bg/fg, check icon).
- **Composer** — 48 dp pill input "Comment, or @Claude to ask for a change" + 48 dp indigo circular send button. Helper line under it.
- **Snackbar** — ink, radius 14, white text, "UNDO" in indigo-on-dark, sits above bottom nav, 6 s.
- **Timeline row** (schedule) — time column right-aligned (14/700 + 12 muted label), 12 dp dot (filled green = done, indigo ring = upcoming/waiting, grey = future), 2 dp connector line, content card.

## 5. Screens (390 × 844 reference)

### 00 Sign in
- Top ~55%: ink background, bottom-aligned stack: logo (mark 40 dp + wordmark 34 sp, white), overline "BLOG · ADMIN" (indigo-on-dark), headline "Review, approve and publish." (Newsreader 36/600, white), "Only approved admin accounts can sign in." (15, `#C9CBD3`).
- Bottom sheet-like white panel, top radius 28: Email field (prefilled `shiva.dhali@kriosity.in`), Password field with "Forgot?" text button, **Sign in** (primary, 52 dp), "or" divider, **Email me a sign-in code** (secondary, mail icon), checkbox "Unlock with fingerprint next time".
- Behaviour: password → `auth.signInWith(Email)`. Code → `signInWith(OTP)` with `createUser = true`, then a code entry step → `verifyEmailOtp(type = EMAIL)`. After sign-in call RPC `blog_is_admin`; if false show "This account isn't a blog admin" + Sign out. Biometric unlock (BiometricPrompt) only gates reopening a stored session; it is not a login method.

### 01 Review queue (home)
- App bar (white, bottom border): logo lockup "kriosity | blog admin", title "Review queue", icon buttons Search and Notifications (dot badge when new drafts).
- Summary banner (§4).
- Tabs: Pending · Scheduled · Published · Rejected · Deleted (web admin uses the same five).
- List of draft cards. Below the list on Pending: divider text "Swipe right to approve · left to reject". Dashed card "Weekly roundup drafts on Sunday — This week in AI · <dates>".
- **Swipe right** → Approve sheet (§ approve). **Swipe left** → Reject sheet. Pull to refresh.
- Empty state (Pending): "No drafts waiting. New ones arrive each morning."
- Bottom nav.

### 02 Draft reader
- App bar: back, "Draft · 1 of 2", comments button with count, overflow (Edit, Delete, Open in web admin).
- Chips: category, "Links to <Product>" when `related_product` set.
- Title (Newsreader 28), meta "Drafted 5:42 AM · 1,480 words · scheduled 6:00 PM".
- Fact-check banner if `fact_flags` not empty; "Claude is revising this post" banner if status `revising`; "Your last feedback" banner if `reject_note`.
- Body rendered from Markdown in Newsreader 18/29. Long-press a passage → highlight (flag bg) → "Comment on this".
- Sources strip above the action bar: "Sources · N linked · View" → bottom sheet listing each source (title as link, publisher, accessed date). If 0 sources: amber "No sources — add one before approving" and Approve disabled.
- Sticky action bar: **Reject** (secondary, X icon) | **Approve** (primary, check icon); full-width text button "Ask Claude to revise…" (opens composer prefilled with "@Claude ").
- Swipe horizontally between drafts in the current tab.

### Approve sheet (not drawn separately; mirrors web)
- Title "Approve and schedule", date-time picker in IST, default = next slot (09:00 or 18:00 IST, at least 15 min ahead), helper "Pick a past time to publish right away". Cancel / Approve. On success → snackbar "Approved — goes live 6:00 PM" with UNDO.

### 03 Reject sheet
- Modal bottom sheet over a dimmed reader (scrim `#5F6270`), drag handle.
- "Reject this draft?" + "Your reason trains the next drafts. Pick all that apply."
- Reason chips (multi-select): Factual error · Weak or missing sources · Already covered · Off-brand tone · Not useful · Other (same list as `REJECT_REASONS` in `lib/types.ts`).
- "Note for Claude (optional)" multiline field.
- Toggle row "Send back for a rewrite — Claude revises and re-queues it" (default ON).
- Cancel (secondary) | **Reject** / **Send back** (danger). Snackbar with UNDO.

### 04 Comments & replies
- App bar: back, "Comments", subtitle = post title (ellipsised), chip "N open".
- Thread cards (§4). Thread anchored to a passage shows the quote; a whole-post thread shows overline "ON THE WHOLE POST".
- When Claude is working on a request: row with indigo dot "Claude is revising…".
- "1 resolved thread hidden · Show".
- Composer pinned to bottom with helper "Tip: long-press any paragraph in the draft to comment on it".
- The bottom-nav **Comments** tab shows all open threads across posts, grouped by post.

### 05 Schedule
- Title "Schedule", "Slots" button (shows slot times; v1 read-only: 9:00 AM and 6:00 PM IST).
- Week strip: 7 day buttons (60 dp tall, radius 14), selected = ink fill.
- Timeline for the selected day: 5:30 AM "Claude drafted N posts" (green dot) → each slot with its post card: Published (green), Waiting for approval (indigo ring, indigo 2 dp card border, note "Approve by 5:45 PM to make this slot" (see slot rules below)), empty slot ("Open — approve a draft into it"). Sunday shows the weekly roundup.
- Snackbar example: "Approved — goes live at 6:00 PM · UNDO".
- **Slot rules (same as `lib/slots.ts`; there is no other cutoff):** slots are 09:00 and 18:00 IST. The approve picker defaults to the next slot at least 15 minutes ahead, so a draft approved after 17:45 defaults to 09:00 next day. The admin can override with any time; a past time publishes immediately. Nothing is ever skipped or published automatically: a slot with no approved post simply stays empty, and an unapproved draft stays in Pending.

### Stats (bottom nav, v2)
Placeholder for now: posts published this week, pending count, subscribers count (`blog_subscribers`). Don't invent page-view numbers; there's no analytics source yet.

## 6. Data mapping (Supabase, all tables in `public`)

| UI | Query / write |
|---|---|
| Queue lists | `select id,slug,title,summary,category,status,publish_at,sources,fact_flags,reading_minutes,deleted_at,created_at from blog_posts order by created_at desc` then bucket: Deleted = `deleted_at not null`; Pending = `status in (pending, revising)`; Rejected = `rejected`; Scheduled = `approved` and `publish_at > now()`; Published = `approved` and `publish_at <= now()` |
| Reader | `select * from blog_posts where id = :id` |
| Approve | `update blog_posts set status='approved', publish_at=:ts where id=:id` (DB rejects if no sources) |
| Reject / send back | `update … set status = 'rejected' or 'revising', reject_reasons = :arr, reject_note = :note` |
| Undo | before the write, snapshot the current value of **every field the action changes** (plus `approved_at`, `approved_by` when `status` changes); UNDO writes that snapshot back and logs an `undo` event. E.g. undoing a reject restores `status`, `reject_reasons` and `reject_note`; undoing an approve restores `status`, `publish_at` and the approval stamps. Same as `update(…, undoable)` in `app/admin/posts/[id]/page.tsx` |
| Delete / restore | `update … set deleted_at = now()` / `null`; permanent: `delete from blog_posts where id=:id` (only from Deleted tab, with confirm) |
| Comments | `select * from blog_comments where post_id=:id order by created_at`; insert `{post_id, parent_id, author_kind:'admin', author_id: auth.uid, body, anchor_text}`; resolve: `update set resolved = not resolved` |
| `@Claude` in a comment | also set the post's `status='revising'` if it was `pending` or `rejected` (web does the same) |
| Audit | after every admin action insert `blog_post_events {post_id, action, actor:'admin:<email>', note}` — actions: approved, rejected, revision_requested, edited, deleted, restored, unpublished, undo |
| Admin check | `rpc('blog_is_admin')` → boolean |

Types and field meanings: `lib/types.ts` and README §3. Times are stored UTC; always display in **Asia/Kolkata**.

## 7. Notifications (v1.1)

Goal: a push when the morning drafts land. Simplest path: Firebase Cloud Messaging + a Supabase
Database Webhook (or Edge Function) on `insert into blog_posts` that sends to the stored FCM token.
Needs a small `blog_devices (user_id, fcm_token)` table — add it as `supabase/migrations/002_…sql`
following README §9. Until then, the app refreshes on open and on pull.

## 8. Acceptance checklist

- [ ] Non-admin accounts can't see any data (RLS) and get the "not an admin" screen.
- [ ] Approve is impossible with zero sources; the error is shown in plain words.
- [ ] Every approve/reject/delete has UNDO for 6 s and writes a `blog_post_events` row.
- [ ] All times shown in IST; default approve time is the next slot.
- [ ] Text scales with system font size up to 200% without clipping; TalkBack labels on icon buttons.
- [ ] Dark mode: not required for v1; lock to light theme.
- [ ] No secrets in the APK beyond the publishable key.
