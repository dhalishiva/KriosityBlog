import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/posts";
import { blogUrl } from "@/lib/site";

export const revalidate = 600;

// Served at https://kriosity.in/blog/sitemap.xml (listed in kriosity.in/robots.txt).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublished(undefined, 1000);
  return [
    { url: blogUrl(), changeFrequency: "daily", priority: 0.9, lastModified: posts[0]?.publish_at ?? new Date() },
    ...posts.map((p) => ({ url: blogUrl(`/${p.slug}`), lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
