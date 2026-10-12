import type { SupabaseClient } from "@supabase/supabase-js";

/** Record an admin action in blog_post_events. Failures are logged, never thrown. */
export async function logEvent(sb: SupabaseClient, postId: string, action: string, email: string, note?: string) {
  const { error } = await sb.from("blog_post_events").insert({ post_id: postId, action, actor: `admin:${email}`, note: note ?? null });
  if (error) console.warn("logEvent", error.message);
}

export type QueueTab = "pending" | "scheduled" | "live" | "rejected" | "deleted";

export const QUEUE_TABS: { id: QueueTab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "scheduled", label: "Scheduled" },
  { id: "live", label: "Published" },
  { id: "rejected", label: "Rejected" },
  { id: "deleted", label: "Deleted" },
];

export function statusChip(p: { status: string; publish_at: string | null; deleted_at: string | null }) {
  if (p.deleted_at) return { cls: "grey", label: "Deleted" };
  if (p.status === "pending") return { cls: "pending", label: "Needs review" };
  if (p.status === "revising") return { cls: "pending", label: "Claude revising" };
  if (p.status === "rejected") return { cls: "bad", label: "Rejected" };
  if (p.status === "approved" && p.publish_at && new Date(p.publish_at) <= new Date()) return { cls: "live", label: "Published" };
  return { cls: "ok", label: "Scheduled" };
}
