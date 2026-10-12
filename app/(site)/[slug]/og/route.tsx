import { ImageResponse } from "next/og";
import { Gem, Mark, ogSize } from "@/lib/og";
import { getPublished } from "@/lib/posts";
import { categoryLabel } from "@/lib/types";
import { formatIST } from "@/lib/slots";

// Share card for X, LinkedIn, WhatsApp etc. Served at /blog/<slug>/og (linked from generateMetadata).
// A route handler instead of the opengraph-image file convention, because that convention
// drops the /blog basePath from the URL it writes into the page.
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublished(slug);
  const title = post?.title ?? "Kriosity Blog";
  const shown = title.length > 110 ? title.slice(0, 107).trimEnd() + "…" : title;
  const fontSize = shown.length > 80 ? 54 : shown.length > 50 ? 62 : 72;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#14203a", padding: "60px 70px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 820 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Mark size={46} />
            <div style={{ fontSize: 38, color: "#ffffff", fontWeight: 700, letterSpacing: -1 }}>kriosity</div>
            <div style={{ fontSize: 30, color: "#c9dafe", marginLeft: 6, paddingLeft: 16, borderLeft: "2px solid rgba(201,218,254,0.5)" }}>blog</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {post && (
              <div style={{ fontSize: 24, color: "#9db8f7", fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, marginBottom: 22 }}>
                {categoryLabel(post.category)}
              </div>
            )}
            <div style={{ fontSize, color: "#ffffff", fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>{shown}</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.7)" }}>
            {post
              ? `${formatIST(post.publish_at, { year: "numeric", hour: undefined, minute: undefined })} · ${post.sources.length} sources · kriosity.in/blog`
              : "AI, tested and explained · kriosity.in/blog"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Gem size={230} />
        </div>
      </div>
    ),
    { ...ogSize, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
