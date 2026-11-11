/** Pure HTTP helpers (no Deno APIs) so they can be unit-tested in Node. */

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
  // Echo the origin back only if it is on the allow-list. Anything else gets no CORS header, so browsers block it.
  if (origin && allowed.includes(origin)) base["Access-Control-Allow-Origin"] = origin;
  return base;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Parses a JSON object body; anything else is a 400. Bodies over 10 kB are refused. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 10_000) throw new HttpError(413, "body_too_large");
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new HttpError(400, "invalid_json");
  return parsed as Record<string, unknown>;
}

export const bearerToken = (req: Request): string | null => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "");
  return m ? m[1].trim() : null;
};
