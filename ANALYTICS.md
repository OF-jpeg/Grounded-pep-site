# Usage Analytics

Tracks **what** is popular, never **who** looked at it. No user IDs, no emails,
no message contents — only anonymous event counts.

This is the data worth having. It tells you what to build next, what content is
missing, and which paywalls actually bite. It also stays consistent with the
Privacy Policy, which promises not to sell personal data.

---

## What gets tracked

| Event | What it tells you |
|---|---|
| `compound_view` | Which compounds people actually care about |
| `search_no_results` | **Content gaps** — searches that found nothing |
| `paywall_hit` | Which limits people hit, i.e. where the perceived value is |

Nothing is tied to an account. Two people viewing BPC-157 produce two identical
anonymous rows.

---

## Reading it without any setup

Open your site, press **F12** → **Console**, and run:

```js
copy(exportUsageSummary())
```

That copies a summary of activity from that browser. Useful for spot-checking,
but only covers your own device.

---

## Cross-user analytics (optional)

To collect events from everyone, run this in **Supabase → SQL Editor**:

```sql
create table analytics_events (
  id bigserial primary key,
  event_type text not null,
  event_value text,
  created_at timestamptz default now()
);

alter table analytics_events enable row level security;

-- Anyone may add an anonymous event...
create policy "anon_insert" on analytics_events
  for insert to anon, authenticated with check (true);

-- ...but nobody can read them from the browser.
-- Query from the Supabase dashboard instead.
```

Nothing breaks if you skip this — it just stays local-only.

---

## Useful queries

**Most-viewed compounds this week**
```sql
select event_value as compound, count(*) as views
from analytics_events
where event_type = 'compound_view'
  and created_at > now() - interval '7 days'
group by 1 order by 2 desc limit 20;
```

**Content gaps — searches that found nothing**
```sql
select event_value as search_term, count(*) as times
from analytics_events
where event_type = 'search_no_results'
group by 1 order by 2 desc limit 30;
```
*The highest-value query here. Every repeated term is a compound or topic
people expect and you don't have.*

**Which paywall bites hardest**
```sql
select event_value as paywall, count(*) as hits
from analytics_events
where event_type = 'paywall_hit'
group by 1 order by 2 desc;
```
*Tells you what people actually want enough to hit a wall for — useful for
pricing and for deciding what belongs in Pro.*

---

## What this is deliberately not

This does **not** log message contents, tracker entries, emails, or anything
tied to an individual. That's a deliberate design choice, not an oversight:

- The Privacy Policy states personal data isn't sold
- Health-adjacent personal data carries real regulatory exposure (GDPR, CCPA, FTC)
- Trust is the core product in a market full of untrustworthy actors

Aggregate insight makes the product better, which is what earns subscriptions.
That's the version of "data as an asset" that actually holds up.
