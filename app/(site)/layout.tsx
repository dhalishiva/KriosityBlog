import Link from "next/link";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="b-header">
        <div className="wrap">
          {/* Plain <a>: kriosity.in is a different app, outside the /blog base path */}
          <a href="https://kriosity.in" className="b-brand" aria-label="Kriosity home">
            <strong>Kriosity</strong>
          </a>
          <nav className="b-nav" aria-label="Main">
            <Link href="/">Blog</Link>
            <a href="https://kriosity.in/products">Products</a>
            <a href="https://kriosity.in/about">About</a>
            <a href="https://kriosity.in/contact">Contact</a>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="b-footer">
        <div className="wrap">
          <span>© {new Date().getFullYear()} Kriosity · Noida, India</span>
          <span>
            Every post lists its sources. Spotted an error? <a href="mailto:hello@kriosity.in">hello@kriosity.in</a> ·{" "}
            <a href="/blog/rss.xml">RSS</a>
          </span>
        </div>
      </footer>
    </>
  );
}
