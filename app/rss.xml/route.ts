import { listPublished } from "@/lib/posts";
import { blogUrl, site } from "@/lib/site";

export const revalidate = 600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const posts = await listPublished(undefined, 50);
  const items = posts
    .map(
      (p) => `<item>
<title>${esc(p.title)}</title>
<link>${blogUrl(`/${p.slug}`)}</link>
<guid isPermaLink="true">${blogUrl(`/${p.slug}`)}</guid>
<pubDate>${new Date(p.publish_at!).toUTCString()}</pubDate>
<description>${esc(p.summary ?? "")}</description>
</item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${esc(site.name)}</title>
<link>${blogUrl()}</link>
<description>${esc(site.description)}</description>
<language>en-in</language>
${items}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
