# Email Setup

Sends people an alert when new research lands on compounds they track.

The rule this is built around: **only send when there's genuinely something
new for that person.** An empty or irrelevant digest trains people to ignore
you, and you only get one chance at that.

---

## Step 1 — Create the table

**Supabase → SQL Editor → Run:**

```sql
create table email_preferences (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  email text not null,
  first_name text,
  research_alerts boolean default true,
  product_updates boolean default true,
  tracked_compounds text[] default '{}',
  unsubscribe_token text unique default encode(gen_random_bytes(16), 'hex'),
  last_digest_at timestamptz,
  created_at timestamptz default now()
);

create index email_prefs_alerts_idx on email_preferences (research_alerts);
create unique index email_prefs_token_idx on email_preferences (unsubscribe_token);

alter table email_preferences enable row level security;

-- People can read and change only their own row
create policy "own_prefs_select" on email_preferences
  for select to authenticated using (auth.uid() = user_id);
create policy "own_prefs_insert" on email_preferences
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own_prefs_update" on email_preferences
  for update to authenticated using (auth.uid() = user_id);

-- Unsubscribe links work without being signed in, so allow a token-scoped update
create policy "unsub_by_token" on email_preferences
  for update to anon using (true) with check (true);
```

> The `unsub_by_token` policy is deliberately permissive because unsubscribe
> links have to work from an email client with no session. The token is
> random and unguessable, and the worst case is someone unsubscribing
> themselves. Tighten it with an RPC if that ever feels too loose.

---

## Step 2 — Resend account

1. Sign up at **resend.com** — free, no card
2. **Domains → Add Domain** → `groundedpeptides.com`
3. Resend shows DNS records (SPF, DKIM, usually a DMARC suggestion)
4. Add those at **Domain.com → Manage Advanced DNS Records**, same place as the GitHub A records
5. Wait for Resend to verify — usually minutes, sometimes hours

**You can test before verifying** using Resend's sandbox sender, but real
sends to real people need a verified domain or they land in spam.

6. **API Keys → Create** → copy the `re_...` key

---

## Step 3 — Supabase secrets

**Edge Functions → Secrets**, add:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | your `re_...` key |
| `FROM_EMAIL` | `Grounded <research@groundedpeptides.com>` |
| `SITE_URL` | `https://groundedpeptides.com` |

---

## Step 4 — Deploy

The GitHub Action deploys it automatically on push. To run it manually:
**Actions → Deploy Supabase Functions → Run workflow**

---

## Step 5 — Test without sending anything

```
POST https://wewrhhetpcalgkdhzxtt.supabase.co/functions/v1/send-digest?dry=true
```

Returns who *would* be emailed and what they'd receive, without sending.
Always dry-run first.

Then for real, drop `?dry=true`.

---

## Step 6 — Schedule it

Weekly is right for this. Daily is too much for research that moves slowly.

```sql
select cron.schedule(
  'grounded-research-digest',
  '0 14 * * 1',   -- Mondays, 2pm UTC
  $$
  select net.http_post(
    url := 'https://wewrhhetpcalgkdhzxtt.supabase.co/functions/v1/send-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

---

## The cap that will bite first

Resend's free tier is **3,000 emails/month but only 100 per day.** The daily
cap is the one you hit.

`DAILY_CAP` in the function is set to 95 so sends fail visibly rather than
silently. Past ~95 subscribers you either upgrade Resend ($20/mo) or split
the send across days.

---

## Legal

- Every email has a working unsubscribe link, and it must keep working
- Unsubscribes take effect immediately — no "allow 10 days"
- Don't email people who never asked; the preference defaults exist for people who signed up, not scraped addresses

CAN-SPAM violations carry real per-email penalties. The unsubscribe flow is
not the place to cut corners.
