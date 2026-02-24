-- Multiple vibes per @username; one vibe per (sender_wallet, target_username).
-- Per-recipient vibe index assigned at confirm time (no gaps when mints are abandoned).

-- 1. Counter table for assigning vibe_index_for_recipient (one row per username)
CREATE TABLE IF NOT EXISTS recipient_vibe_counters (
  target_username text PRIMARY KEY,
  next_index bigint NOT NULL DEFAULT 1
);

-- 2. Per-recipient index on the vibe (set at confirm time)
ALTER TABLE vibes
  ADD COLUMN IF NOT EXISTS vibe_index_for_recipient integer NULL;

-- 3. Unique: one vibe per (sender_wallet, target_username)
-- Use lower(target_username) so @Alice and @alice are the same
CREATE UNIQUE INDEX IF NOT EXISTS vibes_sender_target_unique
  ON vibes (sender_wallet, lower(target_username));

-- 4. RPC: atomically get next index for a username (call from confirm route)
CREATE OR REPLACE FUNCTION get_next_recipient_vibe_index(p_username text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  INSERT INTO recipient_vibe_counters (target_username, next_index)
  VALUES (lower(trim(p_username)), 1)
  ON CONFLICT (target_username)
  DO UPDATE SET next_index = recipient_vibe_counters.next_index + 1
  RETURNING next_index INTO n;
  RETURN n;
END;
$$;
