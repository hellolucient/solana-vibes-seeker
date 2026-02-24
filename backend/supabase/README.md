# Supabase migrations

Run the SQL in `migrations/` against your Supabase project (SQL Editor or `supabase db push` if using Supabase CLI).

## 20250224_vibe_index_and_counters.sql

- Creates `recipient_vibe_counters` for assigning per-recipient vibe index at confirm time.
- Adds `vibe_index_for_recipient` to `vibes`.
- Adds unique constraint on `(sender_wallet, lower(target_username))` so one vibe per wallet per @username.
- Adds RPC function `get_next_recipient_vibe_index(p_username text)` for atomic index assignment.

Run this migration **before** deploying the new backend so the new columns and RPC exist.
