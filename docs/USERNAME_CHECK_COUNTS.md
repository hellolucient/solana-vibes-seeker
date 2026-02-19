# Username check counts

The backend tracks how many times each @username was "checked" — i.e. how many times someone attempted to send a vibe to that username (each call to **Prepare** with that `targetUsername` increments the count).

## Supabase table

Run this in the Supabase SQL editor (Dashboard → SQL Editor) to create the table:

```sql
create table if not exists username_check_counts (
  username text primary key,
  check_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Optional: allow RLS if you use it (adjust policy as needed)
-- alter table username_check_counts enable row level security;
```

After the table exists, the prepare API will record each check automatically.

**Script for X posts:** From the backend directory, run:

```bash
npx tsx scripts/username-check-stats.ts
```

It prints total checks, unique usernames checked, and the top 5 most-checked @usernames so you can copy into a post.
