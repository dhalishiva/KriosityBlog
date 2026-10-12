"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { formatIST } from "@/lib/slots";

type Sub = { id: string; email: string; source: string | null; created_at: string };

export default function Subscribers() {
  const { sb, toast } = useAdmin();
  const [rows, setRows] = useState<Sub[] | null>(null);

  async function load() {
    const { data } = await sb.from("blog_subscribers").select("*").order("created_at", { ascending: false });
    setRows((data as Sub[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    const csv = ["email,source,subscribed_at", ...(rows ?? []).map((r) => `${r.email},${r.source ?? ""},${r.created_at}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "kriosity-blog-subscribers.csv";
    a.click();
  }

  async function remove(s: Sub) {
    if (!confirm(`Remove ${s.email}?`)) return;
    await sb.from("blog_subscribers").delete().eq("id", s.id);
    toast("Subscriber removed");
    load();
  }

  return (
    <>
      <div className="a-row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Subscribers {rows ? `(${rows.length})` : ""}</h1>
        <button className="a-btn" onClick={exportCsv} disabled={!rows?.length}>Export CSV</button>
      </div>
      {!rows ? (
        <p className="a-note">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="a-note">No subscribers yet. The sign-up box is at the bottom of every blog page.</p>
      ) : (
        <div className="a-scroll">
          <table className="a-table">
            <thead>
              <tr><th>Email</th><th>Signed up from</th><th>When</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.source}</td>
                  <td>{formatIST(r.created_at, { year: "numeric" })}</td>
                  <td><button className="a-btn ghost" onClick={() => remove(r)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
