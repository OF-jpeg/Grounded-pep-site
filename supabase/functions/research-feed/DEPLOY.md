# Deploying the PubMed Research Feed

Pulls genuinely new papers from PubMed on a schedule so the Research Hub
stays current without anyone touching it.

Every title, journal, date, and PMID comes straight from NCBI's API.
Nothing is invented. Plain-language summaries, when enabled, are generated
only from the real abstract text.

---

## Step 1 — Create the table

**Supabase → SQL Editor → New query → Run:**

```sql
create table research_feed (
  id bigserial primary key,
  pmid text unique not null,
  title text not null,
  journal text,
  pub_date text,
  authors text,
  pub_type text,
  abstract text,
  plain_summary text,
  compounds text,
  created_at timestamptz default now()
);

create index research_feed_created_idx on research_feed (created_at desc);

alter table research_feed enable row level security;

-- Anyone may read the feed; only the service role can write to it
create policy "public_read" on research_feed
  for select to anon, authenticated using (true);
```

The `unique` constraint on `pmid` is what prevents duplicates — the function
relies on it, so don't remove it.

---

## Step 2 — Deploy the function

**Supabase → Edge Functions → Deploy a new function**

- Function name: `research-feed`
- File name inside it: `index.ts` ← must be exactly this
- Paste the contents of `index.ts` from this folder

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
you do not need to add them as secrets.

### Optional secrets

| Secret | Effect if set |
|---|---|
| `ANTHROPIC_API_KEY` | Adds plain-language summaries (already set if you deployed the `claude` function) |
| `NCBI_EMAIL` | Identifies you to NCBI — good etiquette, and they'll contact you before blocking rather than after |
| `NCBI_API_KEY` | Raises the rate limit from 3 to 10 requests/sec. Free from an NCBI account. Not required. |

---

## Step 3 — Test it manually

In the Supabase function view, hit **Invoke** — or run:

```bash
curl -X POST "https://wewrhhetpcalgkdhzxtt.supabase.co/functions/v1/research-feed" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Expected response:

```json
{ "ok": true, "inserted": 14, "summarised": 14 }
```

Then check **Table Editor → research_feed** to see the rows.

The first run will pull the most papers. Later runs only add genuinely new
ones, so `inserted` will usually be small — often zero on a quiet day. That
is correct behaviour, not a failure.

---

## Step 4 — Put it on a schedule

**Supabase → SQL Editor → Run:**

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Runs daily at 6am UTC
select cron.schedule(
  'grounded-research-feed',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://wewrhhetpcalgkdhzxtt.supabase.co/functions/v1/research-feed',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

Replace `YOUR_ANON_KEY` with your publishable key.

**Check the schedule:**
```sql
select * from cron.job;
```

**Remove it:**
```sql
select cron.unschedule('grounded-research-feed');
```

Daily is the right cadence. PubMed does not move fast enough for hourly to
find anything, and it would burn API calls for nothing.

---

## Cost

**PubMed API:** free.

**Summaries:** uses Claude Haiku, the cheapest model, capped at 25 papers per
run. Realistically a few cents per day — call it **$1–2/month**.

To disable summaries entirely, append `?summarize=false` to the cron URL. The
feed still works, it just shows the real abstract instead of a plain-language
version.

---

## Tuning what it watches

Edit `WATCHLIST` at the top of `index.ts` and redeploy.

Other values worth knowing:

| Constant | Default | Meaning |
|---|---|---|
| `DAYS_BACK` | 45 | How far back each search looks |
| `PER_BATCH_LIMIT` | 12 | Max papers kept per compound batch |
| `BATCH_SIZE` | 6 | Compounds combined into one query |

Compounds are batched into OR queries rather than searched individually —
that keeps the whole run to roughly 15 API calls instead of 90, comfortably
inside NCBI's limits.

---

## Troubleshooting

| Problem | Cause |
|---|---|
| `Insert failed` with a relation error | The table wasn't created — rerun Step 1 |
| `inserted: 0` every time | Normal once caught up. Widen `DAYS_BACK` to confirm it's working. |
| `summarised: 0` but papers inserted | `ANTHROPIC_API_KEY` isn't set, or has no credit |
| Nothing appears on the site | Check the `public_read` policy exists |
| NCBI returns errors | You're being rate limited — set `NCBI_API_KEY`, or increase the `sleep()` values |
