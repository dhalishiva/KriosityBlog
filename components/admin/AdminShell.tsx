"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase";
import Login from "./Login";

type Ctx = { sb: SupabaseClient; session: Session; email: string; toast: (msg: string, undo?: () => void) => void };
const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => {
  const c = useContext(AdminCtx);
  if (!c) throw new Error("useAdmin outside AdminShell");
  return c;
};

type Gate = "loading" | "signed-out" | "not-admin" | "ok";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const sb = browserClient();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [gate, setGate] = useState<Gate>("loading");
  const [toastState, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);

  const check = useCallback(
    async (s: Session | null) => {
      setSession(s);
      if (!s) return setGate("signed-out");
      const { data, error } = await sb.rpc("blog_is_admin");
      setGate(!error && data === true ? "ok" : "not-admin");
    },
    [sb],
  );

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => check(s));
    return () => sub.subscription.unsubscribe();
  }, [sb, check]);

  const toast = useCallback((msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    window.setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 6000);
  }, []);

  if (gate === "loading") return <div className="a-root" aria-busy="true" />;
  if (gate === "signed-out") return <Login />;
  if (gate === "not-admin" || !session)
    return (
      <div className="a-root" style={{ display: "grid", placeItems: "center", padding: "2rem" }}>
        <div className="a-paper" style={{ maxWidth: "28rem", display: "grid", gap: "1rem" }}>
          <h1 style={{ fontSize: "1.4rem", margin: 0 }}>This account isn't a blog admin</h1>
          <p className="a-note" style={{ margin: 0 }}>
            Signed in as {session?.user.email}. Only addresses in the <code>blog_admins</code> table can use this app.
          </p>
          <button className="a-btn" onClick={() => sb.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );

  const nav = [
    { href: "/admin", label: "Queue" },
    { href: "/admin/subscribers", label: "Subscribers" },
    { href: "/admin/account", label: "Account" },
  ];
  const current = (href: string) => (href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/posts") : pathname.startsWith(href));

  return (
    <AdminCtx.Provider value={{ sb, session, email: session.user.email ?? "", toast }}>
      <div className="a-root">
        <header className="a-top">
          <div className="in">
            <span className="a-logo" aria-hidden="true">K</span>
            <strong>Blog admin</strong>
            <nav aria-label="Admin">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
                  {n.label}
                </Link>
              ))}
              <a href="/blog" target="_blank" rel="noopener">View blog</a>
            </nav>
          </div>
        </header>
        <main className="a-main">{children}</main>
        {toastState && (
          <div className="a-toast" role="status">
            <span>{toastState.msg}</span>
            {toastState.undo && (
              <button
                onClick={() => {
                  toastState.undo?.();
                  setToast(null);
                }}
              >
                UNDO
              </button>
            )}
          </div>
        )}
      </div>
    </AdminCtx.Provider>
  );
}
