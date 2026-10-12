import Link from "next/link";
import type { Metadata } from "next";
import { listPublished } from "@/lib/posts";
import { CATEGORIES, categoryLabel } from "@/lib/types";
import { formatIST } from "@/lib/slots";
import { blogUrl } from "@/lib/site";
import Subscribe from "@/components/Subscribe";

export const revalidate = 300;

type Props = { searchParams: Promise<{ category?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { category } = await searchParams;
  const valid = CATEGORIES.some((c) => c.id === category);
  return valid
    ? { title: `${categoryLabel(category!)} — AI`, alternates: { canonical: blogUrl(`?category=${category}`) } }
    : {};
}

export default async function BlogIndex({ searchParams }: Props) {
  const { category } = await searchParams;
  const active = CATEGORIES.some((c) => c.id === category) ? category : undefined;
  const posts = await listPublished(active);

  return (
    <div className="wrap">
      <section className="b-hero">
        <h1>AI, tested and explained.</h1>
        <p>New models, honest comparisons and what each release means for teams building in India. Every post lists where its facts come from.</p>
      </section>

      <nav className="b-filters" aria-label="Categories">
        <Link className="b-chip" href="/" aria-current={!active ? "page" : undefined}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.id} className="b-chip" href={`/?category=${c.id}`} aria-current={active === c.id ? "page" : undefined}>
            {c.label}
          </Link>
        ))}
      </nav>

      {posts.length === 0 ? (
        <div className="b-empty">The first posts are being reviewed. Subscribe below and we'll send them your way.</div>
      ) : (
        <div className="b-grid">
          {posts.map((p) => (
            <Link key={p.id} href={`/${p.slug}`} className="b-card">
              <span className="b-tag">{categoryLabel(p.category)}</span>
              <h2>{p.title}</h2>
              {p.summary && <p>{p.summary}</p>}
              <div className="b-meta">
                <time dateTime={p.publish_at ?? undefined}>{formatIST(p.publish_at, { hour: undefined, minute: undefined, year: "numeric" })}</time>
                {p.reading_minutes ? <span>{p.reading_minutes} min read</span> : null}
                <span>{p.sources.length} {p.sources.length === 1 ? "source" : "sources"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Subscribe source="index" />
    </div>
  );
}
