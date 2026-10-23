import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublished } from "@/lib/posts";
import { renderMarkdown, readingMinutes } from "@/lib/markdown";
import { categoryLabel } from "@/lib/types";
import { formatIST } from "@/lib/slots";
import { blogUrl, products } from "@/lib/site";
import { metaDescription, postTitle } from "@/lib/seo";
import Subscribe from "@/components/Subscribe";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublished(slug);
  if (!post) return { title: "Not found", robots: { index: false } };
  const url = blogUrl(`/${post.slug}`);
  return {
    // <title> and meta description only: shortened for search results (lib/seo.ts).
    // og/twitter/JSON-LD/H1 below keep the full title and summary.
    title: postTitle(post),
    description: metaDescription(post.summary),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.summary ?? undefined,
      publishedTime: post.publish_at ?? undefined,
      modifiedTime: post.updated_at,
      images: [{ url: post.cover_image_url ?? blogUrl(`/${post.slug}/og`), width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@dhalishiva",
      title: post.title,
      description: post.summary ?? undefined,
      images: [post.cover_image_url ?? blogUrl(`/${post.slug}/og`)],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublished(slug);
  if (!post) notFound();

  const product = post.related_product ? products[post.related_product] : undefined;
  const minutes = post.reading_minutes ?? readingMinutes(post.body_md);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary ?? undefined,
    datePublished: post.publish_at,
    dateModified: post.updated_at,
    mainEntityOfPage: blogUrl(`/${post.slug}`),
    author: { "@type": "Organization", name: "Kriosity", url: "https://kriosity.in" },
    publisher: { "@type": "Organization", name: "Kriosity", url: "https://kriosity.in" },
    citation: post.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
  };

  return (
    <div className="wrap">
      <article className="b-post measure" style={{ marginInline: "auto" }}>
        <header>
          <Link href="/" className="b-back">← All posts</Link>
          <div className="b-tag">{categoryLabel(post.category)}</div>
          <h1>{post.title}</h1>
          {post.summary && <p className="b-dek">{post.summary}</p>}
          <div className="b-meta">
            <time dateTime={post.publish_at ?? undefined}>{formatIST(post.publish_at, { year: "numeric" })} IST</time>
            <span>{minutes} min read</span>
            <a href="#references">{post.sources.length} {post.sources.length === 1 ? "source" : "sources"}</a>
          </div>
        </header>

        <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }} />

        <section className="b-refs" id="references" aria-labelledby="refs-h">
          <h2 id="refs-h">References</h2>
          <ol>
            {post.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                {s.publisher && <span className="pub"> — {s.publisher}</span>}
                {s.accessed_at && <span className="pub">, accessed {s.accessed_at}</span>}
              </li>
            ))}
          </ol>
        </section>

        {product && (
          <aside className="b-product" aria-label={`About ${product.name}`}>
            <div>
              <strong>{product.name}, by Kriosity</strong>
              <p>{product.pitch}</p>
            </div>
            <a className="btn btn-light" href={product.url}>See {product.name}</a>
          </aside>
        )}

        <Subscribe source={`post:${post.slug}`} />
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
