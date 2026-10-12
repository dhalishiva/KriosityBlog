"use client";

import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";

export default function Account() {
  const { sb, email, toast } = useAdmin();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 10) return setError("Use at least 10 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    setPw("");
    setPw2("");
    toast("Password saved. You can sign in with it next time.");
  }

  return (
    <div style={{ maxWidth: "30rem", display: "grid", gap: "1.25rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Account</h1>
      <p className="a-note" style={{ margin: 0 }}>Signed in as <strong>{email}</strong>.</p>
      <form className="a-panel" onSubmit={save}>
        <h2>Set or change password</h2>
        <div className="a-field">
          <label htmlFor="pw1">New password</label>
          <input id="pw1" className="a-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="a-field">
          <label htmlFor="pw2">Repeat it</label>
          <input id="pw2" className="a-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {error && <div className="a-error" role="alert">{error}</div>}
        <button className="a-btn primary" disabled={busy}>Save password</button>
      </form>
      <button className="a-btn" onClick={() => sb.auth.signOut()}>Sign out</button>
    </div>
  );
}
