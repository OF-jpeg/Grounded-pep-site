# Suggestions Table

Powers the suggestion box on the Community page. Until this table exists,
submissions queue in the visitor's browser instead of reaching you — so
they aren't lost, but you also can't see them.

Run this once in **Supabase → SQL Editor**:

```sql
create table suggestions (
  id bigserial primary key,
  kind text not null,              -- feature | compound | bug | correction
  body text not null,
  contact_email text,
  page_context text,
  status text default 'new',       -- new | reviewing | done | declined
  created_at timestamptz default now()
);

create index suggestions_created_idx on suggestions (created_at desc);
create index suggestions_kind_idx on suggestions (kind);

alter table suggestions enable row level security;

-- Anyone may submit...
create policy "anon_submit" on suggestions
  for insert to anon, authenticated with check (true);

-- ...but nobody can read them from the browser.
-- Read them in the Supabase dashboard instead.
```

The read restriction matters: without it, anyone could pull every
suggestion ever submitted, including the email addresses people left.

---

## Reading them

**Table Editor → suggestions**, or query by type:

**Everything new, most recent first**
```sql
select created_at, kind, body, contact_email
from suggestions
where status = 'new'
order by created_at desc;
```

**Factual corrections — deal with these first**
```sql
select created_at, body, contact_email
from suggestions
where kind = 'correction' and status = 'new'
order by created_at desc;
```

**What people are asking for most**
```sql
select kind, count(*) from suggestions group by 1 order by 2 desc;
```

**Compound requests**
```sql
select body, count(*) as times
from suggestions
where kind = 'compound'
group by 1 order by 2 desc;
```
A compound requested repeatedly is a clear signal to add it.

---

## Marking things handled

```sql
update suggestions set status = 'done' where id = 12;
```

Statuses are `new`, `reviewing`, `done`, `declined` — nothing enforces
them, they're just a way to keep track.
