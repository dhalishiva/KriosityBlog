import { site } from "./site";

/**
 * Search-result <title> and meta-description rules.
 *
 * Only the <title> tag and <meta name="description"> use these. The H1, URL,
 * og:title / og:description, twitter:*, JSON-LD and RSS keep the full text.
 */

/** Appended by the title template in app/layout.tsx ("%s | Kriosity Blog"). */
export const TITLE_SUFFIX = ` | ${site.name}`;
export const TITLE_TEMPLATE = `%s${TITLE_SUFFIX}`;

export const MAX_TITLE = 70; // Bing flags titles over 70 characters
export const MAX_DESCRIPTION = 160;
export const MAX_SEO_TITLE = 60; // what the drafting job aims for (enforced by the DB)

// Small words that read badly at the end of a cut-off title.
const DANGLING = new Set([
  "a", "an", "and", "are", "as", "at", "by", "for", "from", "how", "in", "is", "its",
  "next", "of", "on", "or", "plus", "the", "to", "vs", "what", "with",
]);

/** Strip trailing punctuation/dashes, dangling small words and stray 1–2 digit numbers. */
function tidyEnd(s: string): string {
  let out = s;
  for (;;) {
    out = out.replace(/[\s\-–—:;,.!?/&(\[{|]+$/u, "");
    const i = out.lastIndexOf(" ");
    if (i <= 0) return out;
    const last = out.slice(i + 1);
    if (DANGLING.has(last.toLowerCase()) || /^\d{1,2}$/.test(last)) {
      out = out.slice(0, i);
      continue;
    }
    return out;
  }
}

/**
 * Shorten `text` to at most `max` characters without "…":
 * 1. If it fits, return it unchanged.
 * 2. Prefer a natural break (", " ": " " — " ". ") if it keeps at least 60% of `max`.
 * 3. Otherwise cut at the last whole word.
 * Then drop trailing punctuation, dashes and dangling small words.
 */
export function shorten(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const window = t.slice(0, max + 1);
  const breakAt = Math.max(window.lastIndexOf(", "), window.lastIndexOf(": "), window.lastIndexOf(" — "), window.lastIndexOf(". "));
  if (breakAt >= 0.6 * max) return tidyEnd(window.slice(0, breakAt));
  const space = window.lastIndexOf(" ");
  return tidyEnd(space > 0 ? window.slice(0, space) : t.slice(0, max));
}

/**
 * The value to put in `metadata.title` for a post.
 * Uses seo_title when set (else the post title). Keeps the " | Kriosity Blog" suffix
 * only when the whole thing fits in 70; otherwise drops it ({ absolute }) and, if still
 * too long, shortens. Result is always ≤ 70 characters.
 */
export function postTitle(post: { title: string; seo_title?: string | null }): string | { absolute: string } {
  const base = (post.seo_title?.trim() || post.title).trim();
  if (base.length + TITLE_SUFFIX.length <= MAX_TITLE) return base; // template adds the suffix
  return { absolute: shorten(base, MAX_TITLE) };
}

/** The final <title> text a post renders (for checks and reports). */
export function renderedPostTitle(post: { title: string; seo_title?: string | null }): string {
  const t = postTitle(post);
  return typeof t === "string" ? t + TITLE_SUFFIX : t.absolute;
}

/**
 * Meta description: ≤ 160 characters. Prefer ending at the last full sentence
 * (keeping its full stop) if that keeps at least 60%; otherwise cut at a whole word.
 */
export function metaDescription(summary: string | null | undefined): string | undefined {
  if (!summary) return undefined;
  const s = summary.trim().replace(/\s+/g, " ");
  if (s.length <= MAX_DESCRIPTION) return s;
  const window = s.slice(0, MAX_DESCRIPTION + 1);
  const stop = window.lastIndexOf(". ");
  if (stop >= 0.6 * MAX_DESCRIPTION) return window.slice(0, stop + 1);
  return shorten(s, MAX_DESCRIPTION);
}
