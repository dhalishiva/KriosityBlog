import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Server-side, anonymous client: only sees what RLS lets the public see. */
export function publicClient(): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let browser: SupabaseClient | null = null;

/** Browser client for the admin app. Session is kept in localStorage. */
export function browserClient(): SupabaseClient {
  if (!browser) {
    browser = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "kriosity-blog-admin" },
    });
  }
  return browser;
}
