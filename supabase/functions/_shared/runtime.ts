/** Deno-only glue: environment, Supabase clients, authentication and the request wrapper shared by every function. */
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { bearerToken, corsHeaders, HttpError, json } from "./http.ts";

export function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback;
  if (v === undefined || v === "") throw new HttpError(500, "server_misconfigured", `Missing secret ${name}`);
  return v;
}

/** Works with both the new key system (SUPABASE_SECRET_KEYS) and the legacy service role key. */
function secretKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      /* fall through to the legacy key */
    }
  }
  return env("SUPABASE_SERVICE_ROLE_KEY");
}

let admin: SupabaseClient | null = null;
/** Bypasses Row Level Security. Server-side only, and only ever after the caller has been authenticated. */
export function adminClient(): SupabaseClient {
  admin ??= createClient(env("SUPABASE_URL"), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export async function requireUser(req: Request): Promise<User> {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "unauthorized", "Sign in to continue");
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Your session has expired. Please sign in again.");
  return data.user;
}

export function allowedOrigins(): string[] {
  const site = Deno.env.get("SITE_URL");
  const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([site, "http://localhost:5173", "http://localhost:4173", ...extra].filter(Boolean) as string[])];
}

/** Wraps a handler with CORS, method checks and uniform error responses. Handlers may return plain objects. */
export function route(methods: string[], fn: (req: Request) => Promise<Response | Record<string, unknown>>) {
  return async (req: Request): Promise<Response> => {
    const cors = corsHeaders(req.headers.get("Origin"), allowedOrigins());
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (!methods.includes(req.method)) return json({ error: "method_not_allowed" }, 405, cors);
    try {
      const out = await fn(req);
      return out instanceof Response ? out : json(out, 200, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status, cors);
      console.error("unhandled error", e);
      return json({ error: "internal_error", message: "Something went wrong. Please try again." }, 500, cors);
    }
  };
}
