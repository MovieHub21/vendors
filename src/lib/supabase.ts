import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isBackendConfigured = Boolean(url && key);

/** Browser-only client (null while prerendering, or when the .env values are missing). Uses the PUBLISHABLE key only. */
export const supabase: SupabaseClient | null =
  typeof window !== "undefined" && url && key
    ? createClient(url, key, {
        auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
      })
    : null;
