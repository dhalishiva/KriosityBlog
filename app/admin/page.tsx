"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/components/admin/AdminShell";
import { QUEUE_TABS, statusChip, type QueueTab } from "@/lib/admin";
import { categoryLabel, type Post } from "@/lib/types";
import { formatIST, nextSlot } from "@/lib/slots";

type Row = Pick<Post, "id" | "slug" | "title" | "summary" | "category" | "status" | "publish_at" | "sources" | "fact_flags" | "reading_minutes" | "deleted_at" | "created_at">;

export default function Queue() {
  const { sb } = useAdmin();
  const [tab, setTab] = useState<QueueTab>("pending");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<QueueTab, number>>({ pending: 0, scheduled: 0, live: 0, rejected: 0, deleted: 0 });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await sb
      .from("blog_posts")
      .select("id,slug,title,summary,category,status,publish_at,sources,fact_flags,reading_minutes,deleted_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return setError(error.message);
    const all = (data ?? []) as Row[];
    const now = Date.now();
    const bucket = (p: Row): QueueTab => {
      if (p.deleted_at) return "deleted";
      if (p.status === "pending" || p.status === "revising") return "pending";
      if (p.status === "rejected") return "rejected";
      return p.publish_at && new Date(p.publish_at).getTime() <= now ? "live" : "scheduled";
    };
    const c = { pending: 0, scheduled: 0, live: 0, rejected: 0, deleted: 0 } as Record<QueueTab, number>;
    all.forEach((p) => c[bucket(p)]++);
    setCounts(c);
    const filtered = all.filter((p) => bucket(p) === tab);
    if (tab === "scheduled") filtered.sort((a, b) => (a.publish_at ?? "").localeCompare(b.publish_at ?? ""));
    if (tab === "live") filtered.sort((a, b) => (b.publish_at ?? "").localeCompare(a.publish_at ?? ""));
    setRows(filtered);
  }, [sb, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(new Date());

  return (
    <>
      <div className="a-banner">
        <div>
          <small>Today, {today}</small>
          <strong>
            {counts.pending === 0 ? "Nothing waiting for you" : `${counts.pending} ${counts.pending === 1 ? "draft" : "drafts"} waiting for you`}
          </strong>
        </div>
        <span className="a-pill-dark">Next slot {formatIST(nextSlot(), { day: undefined, month: undefined })}</span>
      </div>

      <div className="a-tabs" role="tablist" aria-label="Post status">
        {QUEUE_TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label} {counts[t.id] ? counts[t.id] : ""}
          </button>
        ))}
      </div>

      {error && <div className="a-error" role="alert">{error}</div>}
      {!rows ? (
        <p className="a-note">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="a-card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
          <p>{tab === "pending" ? "No drafts waiting. New ones arrive each morning." : "Nothing here."}</p>
        </div>
      ) : (
        <div className="a-list">
          {rows.map((p) => {
            const chip = statusChip(p);
            const flags = Array.isArray(p.fact_flags) ? p.fact_flags.length : 0;
            return (
              <Link key={p.id} href={`/admin/posts/${p.id}`} className="a-card">
                <div className="a-row">
                  <span className="a-chip">{categoryLabel(p.category)}</span>
                  <span className={`a-chip ${chip.cls}`}>{chip.label}</span>
                  <span className="a-note" style={{ marginLeft: "auto" }}>
                    {p.publish_at ? formatIST(p.publish_at) : `Drafted ${formatIST(p.created_at)}`}
                  </span>
                </div>
                <h3 className="a-serif">{p.title}</h3>
                {p.summary && <p>{p.summary}</p>}
                <div className="a-meta">
                  <span>{p.sources.length} {p.sources.length === 1 ? "source" : "sources"}</span>
                  {p.reading_minutes ? <span>{p.reading_minutes} min read</span> : null}
                  {p.sources.length === 0 ? (
                    <span className="a-flagtxt">No sources — can't be approved</span>
                  ) : flags > 0 ? (
                    <span className="a-flagtxt">{flags} {flags === 1 ? "flag" : "flags"}</span>
                  ) : (
                    <span className="a-oktxt">Facts checked</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
