import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: "5rem 0" }}>
      <h1>That post isn't here.</h1>
      <p>It may not be published yet, or the link changed.</p>
      <Link href="/" className="btn btn-primary">All posts</Link>
    </div>
  );
}
