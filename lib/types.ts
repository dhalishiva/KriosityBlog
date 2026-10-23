export type PostStatus = "pending" | "revising" | "approved" | "rejected";

export type Category = "news" | "new-model" | "comparison" | "event" | "guide" | "roundup";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "news", label: "News" },
  { id: "new-model", label: "New model" },
  { id: "comparison", label: "Comparison" },
  { id: "event", label: "Event" },
  { id: "guide", label: "Guide" },
  { id: "roundup", label: "Roundup" },
];

export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c;

/** One reference. Every fact taken from somewhere else must be listed here. */
export type Source = {
  title: string;
  url: string;
  publisher?: string;
  /** ISO date the drafter read the page, e.g. "2026-10-12". */
  accessed_at?: string;
};

export type FactFlag = { claim: string; note?: string };

export type Post = {
  id: string;
  slug: string;
  title: string;
  /** Short title for search results (≤60 chars). Used only for the <title> tag; the H1 uses `title`. */
  seo_title: string | null;
  summary: string | null;
  body_md: string;
  category: Category;
  tags: string[];
  status: PostStatus;
  publish_at: string | null;
  /** Publishing slot given at drafting: morning = 09:00 IST, evening = 18:00 IST. */
  slot: "morning" | "evening" | null;
  sources: Source[];
  fact_flags: FactFlag[];
  related_product: string | null;
  cover_image_url: string | null;
  reading_minutes: number | null;
  reject_reasons: string[];
  reject_note: string | null;
  drafted_by: string;
  approved_at: string | null;
  approved_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_kind: "admin" | "claude";
  author_id: string | null;
  body: string;
  anchor_text: string | null;
  resolved: boolean;
  handled_at: string | null;
  created_at: string;
};

export const REJECT_REASONS = [
  "Factual error",
  "Weak or missing sources",
  "Already covered",
  "Off-brand tone",
  "Not useful",
  "Other",
];
