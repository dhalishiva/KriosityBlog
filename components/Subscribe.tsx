"use client";

import { useState } from "react";
import { browserClient } from "@/lib/supabase";

export default function Subscribe({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const { error } = await browserClient().from("blog_subscribers").insert({ email: email.trim().toLowerCase(), source });
    // 23505 = already subscribed; treat as success so we don't reveal who is on the list.
    setState(!error || error.code === "23505" ? "done" : "error");
  }

  return (
    <section className="b-sub" aria-labelledby="sub-h">
      <div>
        <h2 id="sub-h">This week in AI, every Sunday</h2>
        <p>One email with the releases that mattered and what they mean in practice. No spam.</p>
      </div>
      {state === "done" ? (
        <p className="msg" role="status">You're on the list. See you Sunday.</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor={`sub-${source}`} className="sr-only">Email address</label>
          <input id={`sub-${source}`} type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary" disabled={state === "busy"}>{state === "busy" ? "Adding…" : "Subscribe"}</button>
          {state === "error" && <p className="msg" role="alert">That didn't work. Check the address and try again.</p>}
        </form>
      )}
    </section>
  );
}
