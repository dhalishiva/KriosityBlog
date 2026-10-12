"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/AdminShell";
import { logEvent, statusChip } from "@/lib/admin";
import { renderMarkdown, readingMinutes } from "@/lib/markdown";
import { CATEGORIES, REJECT_REASONS, categoryLabel, type Comment, type Post, type Source } from "@/lib/types";
import { formatIST, fromLocalInput, nextSlot, toLocalInput } from "@/lib/slots";
import { products } from "@/lib/site";

type Event = { id: number; action: string; actor: string; note: string | null; created_at: string };

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { sb, email, session, toast } = useAdmin();
  const [post, setPost] = useState<Post | null>(null);
  const [draft, setDraft] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState("");
  const approveRef = useRef<HTMLDialogElement>(null);
  const rejectRef = useRef<HTMLDialogElement>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);
  const [publishAt, setPublishAt] = useState(toLocalInput(nextSlot()));
  const [reasons, setReasons] = useState<string[]>([]);
  const [rejectNote, setRejectNote] = useState("");
  const [sendBack, setSendBack] = useState(true);

  const load = useCallback(async () => {
    const [p, c, e] = await Promise.all([
      sb.from("blog_posts").select("*").eq("id", id).maybeSingle(),
      sb.from("blog_comments").select("*").eq("post_id", id).order("created_at"),
      sb.from("blog_post_events").select("id,action,actor,note,created_at").eq("post_id", id).order("created_at", { ascending: false }).limit(30),
    ]);
    if (p.error) setError(p.error.message);
    setPost((p.data as Post) ?? null);
    setDraft((p.data as Post) ?? null);
    setComments((c.data as Comment[]) ?? []);
    setEvents((e.data as Event[]) ?? []);
  }, [sb, id]);

  useEffect(() => {
    load();
  }, [load]);

  const html = useMemo(() => renderMarkdown((editing ? draft : post)?.body_md ?? ""), [post, draft, editing]);

  if (!post || !draft) return <p className="a-note">{error ?? "Loading…"}</p>;

  const chip = statusChip(post);
  const canApprove = post.sources.length > 0 && !post.deleted_at;

  /**
   * Write a change to the post. With `undoable`, the toast offers UNDO, which restores
   * every field this change touched (plus approval stamps when status changes) to the
   * exact values they had before — not just the status.
   */
  async function update(patch: Partial<Post>, action: string, note?: string, msg?: string, undoable = false) {
    const before = post!;
    setBusy(true);
    setError(null);
    const { data, error } = await sb.from("blog_posts").update(patch).eq("id", id).select("*").single();
    setBusy(false);
    if (error) {
      setError(error.message.includes("approved_needs_sources") ? "A post needs at least one source before it can be approved." : error.message);
      return false;
    }
    setPost(data as Post);
    setDraft(data as Post);
    await logEvent(sb, id, action, email, note);
    load();
    if (msg) {
      let restore: Partial<Post> | undefined;
      if (undoable) {
        const keys = Object.keys(patch) as (keyof Post)[];
        if ("status" in patch) keys.push("approved_at", "approved_by");
        restore = Object.fromEntries(keys.map((k) => [k, before[k]])) as Partial<Post>;
      }
      toast(msg, restore ? () => update(restore!, "undo", action) : undefined);
    }
    return true;
  }

  async function approve() {
    const iso = fromLocalInput(publishAt);
    const ok = await update({ status: "approved", publish_at: iso }, "approved", `publish_at ${iso}`, `Approved — goes live ${formatIST(iso)}`, true);
    if (ok) approveRef.current?.close();
  }

  async function reject() {
    const status = sendBack ? "revising" : "rejected";
    const ok = await update(
      { status, reject_reasons: reasons, reject_note: rejectNote || null },
      sendBack ? "revision_requested" : "rejected",
      [reasons.join(", "), rejectNote].filter(Boolean).join(" — "),
      sendBack ? "Sent back to Claude for a rewrite" : "Rejected",
      true,
    );
    if (ok) {
      rejectRef.current?.close();
      setReasons([]);
      setRejectNote("");
    }
  }

  async function softDelete() {
    const ok = await update({ deleted_at: new Date().toISOString() }, "deleted", undefined, "Moved to Deleted", true);
    if (ok) deleteRef.current?.close();
  }

  async function hardDelete() {
    setBusy(true);
    const { error } = await sb.from("blog_posts").delete().eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    toast("Deleted permanently");
    router.push("/admin");
  }

  async function saveEdits() {
    const d = draft!;
    const sources = d.sources.filter((s) => s.title.trim() || s.url.trim());
    const ok = await update(
      {
        title: d.title,
        summary: d.summary,
        slug: d.slug,
        category: d.category,
        body_md: d.body_md,
        related_product: d.related_product || null,
        tags: d.tags,
        sources,
        reading_minutes: readingMinutes(d.body_md),
      },
      "edited",
      undefined,
      "Changes saved",
    );
    if (ok) setEditing(false);
  }

  async function addComment(body: string, parentId: string | null, anchor: string | null) {
    if (!body.trim()) return;
    const { error } = await sb.from("blog_comments").insert({ post_id: id, parent_id: parentId, author_kind: "admin", author_id: session.user.id, body: body.trim(), anchor_text: anchor });
    if (error) return setError(error.message);
    // Asking Claude for a change puts the post back in Claude's queue.
    if (/@claude/i.test(body) && (post!.status === "pending" || post!.status === "rejected")) {
      await update({ status: "revising" }, "revision_requested", "via comment");
    }
    setSelection("");
    load();
  }

  async function resolve(c: Comment) {
    await sb.from("blog_comments").update({ resolved: !c.resolved }).eq("id", c.id);
    load();
  }

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (cid: string) => comments.filter((c) => c.parent_id === cid);
  const setSrc = (i: number, patch: Partial<Source>) => setDraft({ ...draft, sources: draft.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <>
      <div className="a-row" style={{ marginBottom: "1rem" }}>
        <Link href="/admin" className="a-btn ghost">← Queue</Link>
        <span className={`a-chip ${chip.cls}`}>{chip.label}</span>
        <span className="a-chip">{categoryLabel(post.category)}</span>
        <span className="a-note" style={{ marginLeft: "auto" }}>
          Drafted {formatIST(post.created_at)} by {post.drafted_by}
        </span>
      </div>
      {error && <div className="a-error" role="alert" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="a-review">
        {/* ---------------------------------------------------------------- content */}
        <div style={{ display: "grid", gap: "1rem" }}>
          {post.fact_flags.length > 0 && (
            <div className="a-flag">
              <strong>{post.fact_flags.length} {post.fact_flags.length === 1 ? "claim needs" : "claims need"} a second look</strong>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {post.fact_flags.map((f, i) => (
                  <li key={i}>
                    {f.claim}
                    {f.note ? ` — ${f.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {post.status === "revising" && <div className="a-flag"><strong>Claude is revising this post</strong>It returns to Pending after the next drafting run.</div>}
          {post.reject_note && <div className="a-flag"><strong>Your last feedback</strong>{post.reject_reasons.join(", ")}{post.reject_reasons.length ? " — " : ""}{post.reject_note}</div>}

          {!editing ? (
            <article className="a-paper">
              <h1 className="a-serif">{post.title}</h1>
              {post.summary && <p style={{ color: "var(--a-body)", fontSize: "1.05rem" }}>{post.summary}</p>}
              <p className="a-note">/blog/{post.slug} · {post.reading_minutes ?? readingMinutes(post.body_md)} min read{post.publish_at ? ` · ${formatIST(post.publish_at)}` : ""}</p>
              <div
                className="prose"
                style={{ fontFamily: "Georgia, serif", fontSize: "1.08rem" }}
                onMouseUp={() => setSelection((window.getSelection()?.toString() ?? "").trim().slice(0, 500))}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <section className="b-refs" style={{ marginTop: "2rem" }}>
                <h2 style={{ fontSize: "1.1rem" }}>References</h2>
                {post.sources.length === 0 ? (
                  <p className="a-flagtxt">No sources yet. Add at least one before approving.</p>
                ) : (
                  <ol className="a-sources">
                    {post.sources.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                        {s.publisher ? ` — ${s.publisher}` : ""}
                        {s.accessed_at ? `, accessed ${s.accessed_at}` : ""}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </article>
          ) : (
            <div className="a-paper" style={{ display: "grid", gap: "1rem" }}>
              <div className="a-field">
                <label htmlFor="e-title">Title</label>
                <input id="e-title" className="a-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="a-field">
                <label htmlFor="e-sum">Summary (shown in lists and search results)</label>
                <textarea id="e-sum" className="a-textarea" style={{ minHeight: "4.5rem" }} value={draft.summary ?? ""} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
              </div>
              <div className="a-row" style={{ alignItems: "end" }}>
                <div className="a-field" style={{ flex: "2 1 14rem" }}>
                  <label htmlFor="e-slug">URL slug</label>
                  <input id="e-slug" className="a-input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
                </div>
                <div className="a-field" style={{ flex: "1 1 9rem" }}>
                  <label htmlFor="e-cat">Category</label>
                  <select id="e-cat" className="a-select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Post["category"] })}>
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="a-field" style={{ flex: "1 1 9rem" }}>
                  <label htmlFor="e-prod">Mention product</label>
                  <select id="e-prod" className="a-select" value={draft.related_product ?? ""} onChange={(e) => setDraft({ ...draft, related_product: e.target.value || null })}>
                    <option value="">None</option>
                    {Object.entries(products).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="a-field">
                <label htmlFor="e-body">Body (Markdown — don't add a references section, it's built from the sources below)</label>
                <textarea id="e-body" className="a-textarea code" value={draft.body_md} onChange={(e) => setDraft({ ...draft, body_md: e.target.value })} />
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: ".6rem" }}>
                <legend className="a-label" style={{ marginBottom: ".5rem" }}>Sources (required — every fact taken from elsewhere must be listed)</legend>
                {draft.sources.map((s, i) => (
                  <div key={i} className="a-row" style={{ alignItems: "end", background: "var(--a-ground)", padding: ".6rem", borderRadius: ".8rem" }}>
                    <div className="a-field" style={{ flex: "2 1 12rem" }}>
                      <label htmlFor={`s-t-${i}`}>Title</label>
                      <input id={`s-t-${i}`} className="a-input" value={s.title} onChange={(e) => setSrc(i, { title: e.target.value })} />
                    </div>
                    <div className="a-field" style={{ flex: "3 1 14rem" }}>
                      <label htmlFor={`s-u-${i}`}>URL</label>
                      <input id={`s-u-${i}`} className="a-input" type="url" value={s.url} onChange={(e) => setSrc(i, { url: e.target.value })} />
                    </div>
                    <div className="a-field" style={{ flex: "1 1 8rem" }}>
                      <label htmlFor={`s-p-${i}`}>Publisher</label>
                      <input id={`s-p-${i}`} className="a-input" value={s.publisher ?? ""} onChange={(e) => setSrc(i, { publisher: e.target.value })} />
                    </div>
                    <button type="button" className="a-btn" aria-label={`Remove source ${i + 1}`} onClick={() => setDraft({ ...draft, sources: draft.sources.filter((_, j) => j !== i) })}>Remove</button>
                  </div>
                ))}
                <button type="button" className="a-btn" style={{ justifySelf: "start" }} onClick={() => setDraft({ ...draft, sources: [...draft.sources, { title: "", url: "", publisher: "", accessed_at: new Date().toISOString().slice(0, 10) }] })}>
                  + Add source
                </button>
              </fieldset>
              <div className="a-row">
                <button className="a-btn primary" onClick={saveEdits} disabled={busy}>Save changes</button>
                <button className="a-btn" onClick={() => { setDraft(post); setEditing(false); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- side */}
        <aside className="a-side">
          <section className="a-panel" aria-labelledby="act-h">
            <h2 id="act-h">Decision</h2>
            {post.deleted_at ? (
              <div className="a-actions">
                <button className="a-btn primary full" disabled={busy} onClick={() => update({ deleted_at: null }, "restored", undefined, "Restored", true)}>Restore</button>
                <button className="a-btn danger full" disabled={busy} onClick={() => deleteRef.current?.showModal()}>Delete permanently…</button>
              </div>
            ) : (
              <div className="a-actions">
                <button className="a-btn lg" disabled={busy} onClick={() => rejectRef.current?.showModal()}>Reject</button>
                <button className="a-btn primary lg" disabled={busy || !canApprove} onClick={() => { setPublishAt(toLocalInput(post.publish_at && new Date(post.publish_at) > new Date() ? post.publish_at : nextSlot())); approveRef.current?.showModal(); }}>
                  {post.status === "approved" ? "Reschedule" : "Approve"}
                </button>
                {!canApprove && <p className="a-note full" style={{ margin: 0 }}>Add at least one source to approve.</p>}
                {post.status === "approved" && (
                  <button className="a-btn full" disabled={busy} onClick={() => update({ status: "pending" }, "unpublished", undefined, "Moved back to Pending", true)}>
                    Unpublish (back to Pending)
                  </button>
                )}
                <button className="a-btn full" onClick={() => setEditing(true)} disabled={editing}>Edit post</button>
                <button className="a-btn ghost full" onClick={() => deleteRef.current?.showModal()}>Delete…</button>
              </div>
            )}
          </section>

          <section className="a-panel" aria-labelledby="cm-h">
            <h2 id="cm-h">Comments ({comments.filter((c) => !c.resolved && !c.parent_id).length} open)</h2>
            {roots.length === 0 && <p className="a-note" style={{ margin: 0 }}>No comments yet. Select text in the post to comment on it. Mention @Claude to ask for a change.</p>}
            {roots.map((c) => (
              <Thread key={c.id} root={c} replies={repliesOf(c.id)} onReply={(b) => addComment(b, c.id, null)} onResolve={() => resolve(c)} />
            ))}
            <NewComment selection={selection} onClearSelection={() => setSelection("")} onSubmit={(b, a) => addComment(b, null, a)} />
          </section>

          <section className="a-panel" aria-labelledby="hist-h">
            <h2 id="hist-h">History</h2>
            {events.length === 0 ? (
              <p className="a-note" style={{ margin: 0 }}>No actions yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1rem", display: "grid", gap: ".3rem", fontSize: ".85rem" }}>
                {events.map((e) => (
                  <li key={e.id}>
                    <strong>{e.action.replace(/_/g, " ")}</strong> · {e.actor.replace("admin:", "")} · {formatIST(e.created_at)}
                    {e.note ? <div className="a-note">{e.note}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* ---------------------------------------------------------------- dialogs */}
      <dialog ref={approveRef} className="a-dialog" aria-labelledby="ap-h">
        <form method="dialog" className="in" onSubmit={(e) => { e.preventDefault(); approve(); }}>
          <h2 id="ap-h">Approve and schedule</h2>
          <div className="a-field">
            <label htmlFor="ap-at">Goes live at (IST)</label>
            <input id="ap-at" className="a-input" type="datetime-local" required value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          </div>
          <p className="a-note" style={{ margin: 0 }}>Default is the next free slot (9:00 AM or 6:00 PM). Pick a past time to publish right away.</p>
          <div className="a-actions">
            <button type="button" className="a-btn lg" onClick={() => approveRef.current?.close()}>Cancel</button>
            <button className="a-btn primary lg" disabled={busy}>Approve</button>
          </div>
        </form>
      </dialog>

      <dialog ref={rejectRef} className="a-dialog" aria-labelledby="rj-h">
        <form method="dialog" className="in" onSubmit={(e) => { e.preventDefault(); reject(); }}>
          <h2 id="rj-h">Reject this draft?</h2>
          <p className="a-note" style={{ margin: 0 }}>Your reason guides the next drafts. Pick all that apply.</p>
          <div className="a-chips" role="group" aria-label="Reasons">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" className="a-chipbtn" aria-pressed={reasons.includes(r)} onClick={() => setReasons(reasons.includes(r) ? reasons.filter((x) => x !== r) : [...reasons, r])}>
                {r}
              </button>
            ))}
          </div>
          <div className="a-field">
            <label htmlFor="rj-note">Note for Claude (optional)</label>
            <textarea id="rj-note" className="a-textarea" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          </div>
          <label className="a-switch">
            <input type="checkbox" checked={sendBack} onChange={(e) => setSendBack(e.target.checked)} />
            <span>
              <strong style={{ display: "block" }}>Send back for a rewrite</strong>
              <span className="a-note">Claude revises it and puts it back in Pending</span>
            </span>
          </label>
          <div className="a-actions">
            <button type="button" className="a-btn lg" onClick={() => rejectRef.current?.close()}>Cancel</button>
            <button className="a-btn danger lg" disabled={busy}>{sendBack ? "Send back" : "Reject"}</button>
          </div>
        </form>
      </dialog>

      <dialog ref={deleteRef} className="a-dialog" aria-labelledby="dl-h">
        <div className="in">
          <h2 id="dl-h">{post.deleted_at ? "Delete permanently?" : "Delete this post?"}</h2>
          <p className="a-note" style={{ margin: 0 }}>
            {post.deleted_at
              ? "This removes the post, its comments and can't be undone."
              : "It moves to Deleted and comes off the site. You can restore it from there."}
          </p>
          <div className="a-actions">
            <button className="a-btn lg" onClick={() => deleteRef.current?.close()}>Cancel</button>
            <button className="a-btn danger lg" disabled={busy} onClick={post.deleted_at ? hardDelete : softDelete}>Delete</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function Thread({ root, replies, onReply, onResolve }: { root: Comment; replies: Comment[]; onReply: (b: string) => void; onResolve: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className="a-thread" style={root.resolved ? { opacity: 0.6 } : undefined}>
      {root.anchor_text && <blockquote className="a-quote" style={{ margin: 0 }}>“{root.anchor_text}”</blockquote>}
      {[root, ...replies].map((c, i) => (
        <div key={c.id} className={`a-msg${i > 0 ? " reply" : ""}`}>
          <span className={`a-ava${c.author_kind === "claude" ? " claude" : ""}`} aria-hidden="true">{c.author_kind === "claude" ? "C" : "S"}</span>
          <div>
            <div className="a-row" style={{ gap: ".5rem" }}>
              <strong style={{ fontSize: ".88rem" }}>{c.author_kind === "claude" ? "Claude" : "You"}</strong>
              <span className="a-note">{formatIST(c.created_at)}</span>
            </div>
            <p>{c.body}</p>
          </div>
        </div>
      ))}
      {open ? (
        <form
          style={{ display: "grid", gap: ".5rem" }}
          onSubmit={(e) => {
            e.preventDefault();
            onReply(text);
            setText("");
            setOpen(false);
          }}
        >
          <label htmlFor={`r-${root.id}`} className="sr-only">Reply</label>
          <textarea id={`r-${root.id}`} className="a-textarea" style={{ minHeight: "4rem" }} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          <div className="a-row">
            <button className="a-btn primary">Reply</button>
            <button type="button" className="a-btn" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="a-row">
          <button className="a-btn" onClick={() => setOpen(true)}>Reply</button>
          <button className="a-btn ghost" onClick={onResolve}>{root.resolved ? "Reopen" : "Resolve"}</button>
        </div>
      )}
    </div>
  );
}

function NewComment({ selection, onClearSelection, onSubmit }: { selection: string; onClearSelection: () => void; onSubmit: (body: string, anchor: string | null) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      style={{ display: "grid", gap: ".5rem" }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text, selection || null);
        setText("");
      }}
    >
      {selection && (
        <div className="a-quote">
          On: “{selection.length > 140 ? selection.slice(0, 140) + "…" : selection}”{" "}
          <button type="button" className="a-btn ghost" style={{ minHeight: "2rem", padding: "0 .4rem" }} onClick={onClearSelection}>Clear</button>
        </div>
      )}
      <label htmlFor="new-cm" className="sr-only">New comment</label>
      <textarea id="new-cm" className="a-textarea" style={{ minHeight: "4.5rem" }} placeholder="Comment, or @Claude to ask for a change" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="a-btn primary" disabled={!text.trim()}>Comment</button>
    </form>
  );
}
