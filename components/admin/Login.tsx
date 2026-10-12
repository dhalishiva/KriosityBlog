"use client";

import { useState } from "react";
import { browserClient } from "@/lib/supabase";
import Logo from "@/components/Logo";

export default function Login() {
  const sb = browserClient();
  const [email, setEmail] = useState("shiva.dhali@kriosity.in");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"password" | "code-sent">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Wrong email or password. First time here? Use “Email me a sign-in code”." : error.message);
  }

  async function sendCode() {
    if (!email.trim()) return setError("Enter your email first.");
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/blog/admin` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setMode("code-sent");
    setInfo(`We sent an email to ${email.trim()}. Enter the code from it, or just tap the link in the email.`);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <div className="a-root a-login">
      <div className="brand">
        <Logo light size={34} />
        <span className="over">Blog · Admin</span>
        <h1>Review, approve and publish.</h1>
        <p>Only approved admin accounts can sign in.</p>
      </div>
      <div className="panel">
        {mode === "password" ? (
          <form onSubmit={signInPassword}>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Sign in</h2>
            <div className="a-field">
              <label htmlFor="lg-email">Email</label>
              <input id="lg-email" className="a-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="a-field">
              <label htmlFor="lg-pass">Password</label>
              <input id="lg-pass" className="a-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="a-error" role="alert">{error}</div>}
            <button className="a-btn primary lg" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            <div className="a-or">or</div>
            <button type="button" className="a-btn lg" onClick={sendCode} disabled={busy}>Email me a sign-in code</button>
            <p className="a-note" style={{ margin: 0 }}>No password yet? Use the code once, then set a password under Account.</p>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Check your email</h2>
            {info && <p className="a-note" style={{ margin: 0 }}>{info}</p>}
            <div className="a-field">
              <label htmlFor="lg-code">Sign-in code</label>
              <input id="lg-code" className="a-input" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            {error && <div className="a-error" role="alert">{error}</div>}
            <button className="a-btn primary lg" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
            <button type="button" className="a-btn ghost" onClick={() => { setMode("password"); setError(null); }}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}
