# Deploying the Claude Edge Function

This function holds your Anthropic API key server-side so it's never
exposed in the website's source code. **The AI on the site will not work
until this is deployed.**

---

## Step 1 — Get an Anthropic API key

1. Go to **console.anthropic.com**
2. Sign up / sign in
3. Go to **Billing** and add credits (pay-as-you-go — start small, $5–10 is plenty to test)
4. Go to **API Keys → Create Key**, copy it (starts with `sk-ant-...`)

Keep this key private. Never paste it into frontend code, GitHub, or a chat.

---

## Step 2 — Store the key as a Supabase secret

1. Supabase dashboard → **Edge Functions** → **Secrets** (or Settings → Edge Functions)
2. Add a new secret:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your `sk-ant-...` key
3. Save

---

## Step 3 — Deploy the function

### Option A — Dashboard (no CLI needed)

1. Supabase dashboard → **Edge Functions** → **Deploy a new function**
2. Name it exactly: `claude`
3. Paste the entire contents of `index.ts` from this folder
4. Deploy

### Option B — CLI (one command)

```bash
npx supabase functions deploy claude --project-ref wewrhhetpcalgkdhzxtt
```

---

## Step 4 — Test it

Open the site, go to **AI Guide**, and send a message.

**If it works:** you'll see a streaming response.

**If it doesn't:** open browser DevTools → Console. Common errors:

| Error | Cause | Fix |
|---|---|---|
| `Server misconfigured: ANTHROPIC_API_KEY secret is not set` | Secret missing or misnamed | Recheck Step 2 — name must match exactly |
| `401` from Anthropic | Invalid API key | Regenerate the key, update the secret |
| `400 credit balance too low` | No credits | Add credits at console.anthropic.com |
| `404` on the function URL | Function not deployed, or wrong name | Must be named `claude` |
| CORS error | Function didn't deploy correctly | Redeploy |

---

## Built-in cost guardrails

The function enforces these server-side, so a tampered browser client
can't run up your bill:

- **Model allowlist** — only `claude-sonnet-5`, `claude-opus-5`, and
  `claude-haiku-4-5-20251001` are permitted. Anything else falls back to the default.
- **`max_tokens` capped at 2048** regardless of what the client requests
- **Conversation trimmed to the last 40 messages** so context can't grow unbounded

To change the default model, edit `DEFAULT_MODEL` in `index.ts` and redeploy.

---

## Cost notes

Roughly **1–3¢ per AI message** on Sonnet 5, depending on conversation length.

Your free tier allows 10 messages/day per user. If 100 free users max that
out daily, that's roughly **$10–30/day**. Watch usage at
console.anthropic.com and consider lowering `FREE_LIMITS.aiPerDay` in
`billing.js` before a wider launch.

Switching `DEFAULT_MODEL` to `claude-haiku-4-5-20251001` cuts costs
substantially if quality is acceptable for your use case.
