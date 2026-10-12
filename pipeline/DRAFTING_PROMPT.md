# Daily drafting job — instructions

This file is the complete brief for whoever drafts posts (today a Claude scheduled task;
any other AI or person can follow it unchanged). Run once a day around 05:30 IST.
The job **never publishes**. It only writes rows with `status = 'pending'`; a human admin
approves them in the admin app (kriosity.in/blog/admin).

Database: Supabase project in `README.md` → "Where things live". Write with SQL as the
service role (Supabase MCP `execute_sql`, or `psql` with the DB connection string).

---

## 1. Handle feedback first

1. **Revisions.** For every post with `status = 'revising'`:
   read `reject_reasons`, `reject_note` and all comments where `author_kind = 'admin'`
   and `handled_at is null`. Rewrite the post to address them, then
   `update blog_posts set body_md=…, title=…, sources=…, fact_flags=…, status='pending', reject_reasons='{}', reject_note=null`.
2. **Comments on any post** (`author_kind='admin' and handled_at is null`):
   - If it asks for a change (mentions @Claude or is clearly an instruction), make the change.
   - Reply with one short comment: `insert into blog_comments (post_id, parent_id, author_kind, body) values (…, <root comment id>, 'claude', '<what you changed, or why not>')`.
   - Mark handled: `update blog_comments set handled_at = now() where id = …`.
3. Log each action: `insert into blog_post_events (post_id, action, actor, note) values (…, 'revised', 'claude', …)`.

## 2. Pick today's topics (2 posts, plus a roundup on Sundays)

Check what is already covered so you don't repeat it:
`select title, slug, category, created_at from blog_posts where created_at > now() - interval '30 days' and deleted_at is null;`
Also read recently rejected titles and their `reject_reasons` — avoid what was rejected.

Search the web for AI news from the last 48 hours (model releases from OpenAI, Anthropic,
Google, Meta, Mistral, Alibaba/Qwen, DeepSeek and others; notable research; major
events and conferences; pricing and policy changes, especially in India).

Prefer topics where Kriosity can add something beyond the news itself:
- **Comparisons** that explain real differences (pricing in ₹, context limits, Indian-language support, latency from India). Never invent benchmark scores; cite them.
- **"What it means for teams in India"** angles.
- **Practical guides** ("use model X for Y").
- **Roundup** (Sundays only): "This week in AI" — 6–10 items, one paragraph each, each with its source.

Skip: rumours without a primary source, pure rewrites of one article, anything you can't source.

## 3. Sourcing rules (hard requirements)

- **Every fact taken from somewhere else must have a source in `sources`.** Numbers, prices,
  benchmark results, dates, quotes, release details, feature claims — all of them.
- Prefer primary sources: the vendor's own blog/docs/pricing page, the paper, the official
  event page. Use news coverage only when no primary source exists, and name the publisher.
- In the body, cite inline as a Markdown link on the claim, e.g.
  `The vendor's model card lists [the context window and pricing](https://…)`. The same URL must
  also appear in `sources`.
- `sources` is a JSON array: `[{"title":"…","url":"https://…","publisher":"…","accessed_at":"YYYY-MM-DD"}]`.
  The database rejects a source without `title` or an `http(s)` `url`, and refuses to approve
  a post with zero sources.
- Do **not** write a "References" or "Sources" section in `body_md`; the site renders it from `sources`.
- If a claim has only one weak source, or you couldn't verify it, keep it out — or keep it and add it to
  `fact_flags`: `[{"claim":"…","note":"only one source / couldn't open the page / etc."}]`. The admin sees flags in amber.
- Quote sparingly: at most one short quote (under 15 words) per source. Everything else in your own words.
- Never copy an article's structure or paragraphs. Write an original piece that adds analysis.

## 4. Writing rules

- Audience: developers, founders and IT teams, many in India. Plain English, no hype words
  ("revolutionary", "game-changer"), no filler intros. Lead with what changed and why it matters.
- 700–1,500 words for news/comparisons/guides; roundups can be longer.
- Use `##` subheadings, short paragraphs, a table for comparisons.
- `title`: 10–160 characters, specific, no clickbait. `summary`: 1–2 sentences, under 200 characters.
- `slug`: lowercase words joined by hyphens, unique (check before inserting).
- `category`: one of `news`, `new-model`, `comparison`, `event`, `guide`, `roundup`.
- `related_product`: set only when it genuinely fits, else null — `paidtwice` (AP / invoices / payments),
  `slotrecover` (appointments / clinics / salons), `mahina` (fees / small businesses in India),
  `aegistra` (AI governance / compliance), `kriosityops` (founders running many apps),
  `beamdrop` (file transfer). The site adds a short product box; don't sell in the body.
- `reading_minutes`: words ÷ 220, rounded.

## 5. Insert

```sql
insert into blog_posts (slug, title, summary, body_md, category, tags, sources, fact_flags, related_product, reading_minutes, status, drafted_by)
values ('…', '…', '…', $md$…markdown…$md$, 'comparison', '{qwen,gpt,claude}',
        '[{"title":"…","url":"https://…","publisher":"…","accessed_at":"2026-10-12"}]'::jsonb,
        '[]'::jsonb, null, 6, 'pending', 'claude');
insert into blog_post_events (post_id, action, actor, note) values (<new id>, 'drafted', 'claude', null);
```

Leave `publish_at` empty — the admin picks the slot (9:00 AM / 6:00 PM IST) when approving.

## 6. Finish

Report in one short message: how many posts drafted (titles), how many revisions and comment
replies handled, and anything that needs the admin's attention.
