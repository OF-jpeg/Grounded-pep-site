// ══════════════════════════════════════════════════════════════
//  GROUNDED — Claude API Proxy (Supabase Edge Function)
// ══════════════════════════════════════════════════════════════
// Keeps the Anthropic API key server-side. The browser calls this
// function instead of api.anthropic.com directly, so the key is
// never exposed in frontend source.
//
// Deploy notes are in supabase/functions/claude/DEPLOY.md

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// ── Cost guardrails ───────────────────────────────────────────
// Only these models may be requested, and max_tokens is capped,
// so a tampered client can't run up the bill with an expensive
// model or a huge generation.
const ALLOWED_MODELS = new Set([
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
]);
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_TOKENS_CAP = 2048;
const MAX_MESSAGES = 40; // trim very long conversations

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return json(
      { error: "Server misconfigured: ANTHROPIC_API_KEY secret is not set." },
      500,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // ── Sanitize the request before forwarding ──────────────────
  const model = ALLOWED_MODELS.has(body.model as string)
    ? (body.model as string)
    : DEFAULT_MODEL;

  const requestedTokens = Number(body.max_tokens) || 1024;
  const max_tokens = Math.min(requestedTokens, MAX_TOKENS_CAP);

  let messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(-MAX_MESSAGES); // keep most recent turns
  }
  if (messages.length === 0) {
    return json({ error: "No messages provided" }, 400);
  }

  const payload: Record<string, unknown> = {
    model,
    max_tokens,
    messages,
  };
  if (typeof body.system === "string" && body.system.length) {
    payload.system = body.system;
  }
  if (body.stream === true) payload.stream = true;

  // ── Forward to Anthropic ────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: "Upstream request failed", detail: String(e) }, 502);
  }

  // Surface upstream errors (bad key, out of credits, rate limit, etc.)
  if (!upstream.ok) {
    const text = await upstream.text();
    return json(
      { error: "Anthropic API error", status: upstream.status, detail: text },
      upstream.status,
    );
  }

  // Stream server-sent events straight through to the browser
  if (payload.stream) {
    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const data = await upstream.json();
  return json(data);
});
