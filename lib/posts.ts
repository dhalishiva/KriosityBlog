import { publicClient } from "./supabase";
import type { Post } from "./types";

const PUBLIC_COLS =
  "id,slug,title,seo_title,summary,body_md,category,tags,status,publish_at,sources,related_product,cover_image_url,reading_minutes,updated_at,created_at";

/** Live posts only (RLS also enforces this: approved, not deleted, publish_at in the past). */
export async function listPublished(category?: string, limit = 60): Promise<Post[]> {
  let q = publicClient()
    .from("blog_posts")
    .select(PUBLIC_COLS)
    .eq("status", "approved")
    .is("deleted_at", null)
    .lte("publish_at", new Date().toISOString())
    .order("publish_at", { ascending: false })
    .limit(limit);
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) {
    console.error("listPublished", error.message);
    return [];
  }
  return (data ?? []) as unknown as Post[];
}

export async function getPublished(slug: string): Promise<Post | null> {
  const { data, error } = await publicClient()
    .from("blog_posts")
    .select(PUBLIC_COLS)
    .eq("slug", slug)
    .eq("status", "approved")
    .is("deleted_at", null)
    .lte("publish_at", new Date().toISOString())
    .maybeSingle();
  if (error) console.error("getPublished", error.message);
  return (data as unknown as Post) ?? null;
}
