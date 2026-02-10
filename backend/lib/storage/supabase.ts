/**
 * Supabase client and vibe store implementation.
 * Production-ready persistent storage.
 */

import { createClient } from "@supabase/supabase-js";
import type { VibeRecord, IVibeStore } from "./types";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "");

// Database row type (snake_case from Postgres)
interface VibeRow {
  id: string;
  target_user_id: string;
  target_username: string;
  sender_wallet: string;
  masked_wallet: string;
  created_at: string;
  vibe_number: number | null;
  mint_address: string | null;
  metadata_uri: string | null;
  image_uri: string | null;
  claim_status: string;
  claimer_wallet: string | null;
  claimed_at: string | null;
}

// Convert database row to VibeRecord
function rowToRecord(row: VibeRow): VibeRecord {
  return {
    id: row.id,
    targetUserId: row.target_user_id,
    targetUsername: row.target_username,
    senderWallet: row.sender_wallet,
    maskedWallet: row.masked_wallet,
    createdAt: row.created_at,
    vibeNumber: row.vibe_number ?? undefined,
    mintAddress: row.mint_address ?? undefined,
    metadataUri: row.metadata_uri ?? undefined,
    imageUri: row.image_uri ?? undefined,
    claimStatus: row.claim_status as VibeRecord["claimStatus"],
    claimerWallet: row.claimer_wallet ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
  };
}

// Convert VibeRecord to database row format
function recordToRow(record: Partial<VibeRecord>): Partial<VibeRow> {
  const row: Partial<VibeRow> = {};
  
  if (record.id !== undefined) row.id = record.id;
  if (record.targetUserId !== undefined) row.target_user_id = record.targetUserId;
  if (record.targetUsername !== undefined) row.target_username = record.targetUsername;
  if (record.senderWallet !== undefined) row.sender_wallet = record.senderWallet;
  if (record.maskedWallet !== undefined) row.masked_wallet = record.maskedWallet;
  if (record.vibeNumber !== undefined) row.vibe_number = record.vibeNumber;
  if (record.mintAddress !== undefined) row.mint_address = record.mintAddress;
  if (record.metadataUri !== undefined) row.metadata_uri = record.metadataUri;
  if (record.imageUri !== undefined) row.image_uri = record.imageUri;
  if (record.claimStatus !== undefined) row.claim_status = record.claimStatus;
  if (record.claimerWallet !== undefined) row.claimer_wallet = record.claimerWallet;
  if (record.claimedAt !== undefined) row.claimed_at = record.claimedAt;
  
  return row;
}

// Check if a username has already been vibed
export async function getVibeByUsername(username: string): Promise<VibeRecord | null> {
  const normalizedUsername = username.replace(/^@/, "").toLowerCase();
  
  const { data, error } = await supabase
    .from("vibes")
    .select()
    .ilike("target_username", normalizedUsername)
    .limit(1)
    .single();

  if (error) {
    // No vibe found is expected, not an error
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[Supabase] getVibeByUsername error:", error);
    return null;
  }

  return rowToRecord(data as VibeRow);
}

// Get a pending (unclaimed) vibe for a username, if any (most recent first)
export async function getPendingVibeByUsername(username: string): Promise<VibeRecord | null> {
  const normalizedUsername = username.replace(/^@/, "").toLowerCase();

  const { data, error } = await supabase
    .from("vibes")
    .select()
    .ilike("target_username", normalizedUsername)
    .eq("claim_status", "pending")
    .not("mint_address", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getPendingVibeByUsername error:", error);
    return null;
  }

  return data ? rowToRecord(data as VibeRow) : null;
}

// Get the most recent claimed vibe for a username (for "already been vibed" + Solscan link)
export async function getClaimedVibeByUsername(username: string): Promise<VibeRecord | null> {
  const normalizedUsername = username.replace(/^@/, "").toLowerCase();

  const { data, error } = await supabase
    .from("vibes")
    .select()
    .ilike("target_username", normalizedUsername)
    .eq("claim_status", "claimed")
    .not("mint_address", "is", null)
    .order("claimed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getClaimedVibeByUsername error:", error);
    return null;
  }

  return data ? rowToRecord(data as VibeRow) : null;
}

export const vibeStore: IVibeStore = {
  async getNextVibeNumber() {
    // Get the current count of vibes to determine the next number
    const { count, error } = await supabase
      .from("vibes")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("[Supabase] Count error:", error);
      // Default to 1 if count fails
      return 1;
    }

    // Next vibe number is count + 1
    return (count ?? 0) + 1;
  },

  async create(vibe) {
    const row: Omit<VibeRow, "created_at"> = {
      id: vibe.id,
      target_user_id: vibe.targetUserId,
      target_username: vibe.targetUsername,
      sender_wallet: vibe.senderWallet,
      masked_wallet: vibe.maskedWallet,
      vibe_number: vibe.vibeNumber ?? null,
      mint_address: vibe.mintAddress ?? null,
      metadata_uri: vibe.metadataUri ?? null,
      image_uri: vibe.imageUri ?? null,
      claim_status: "pending",
      claimer_wallet: null,
      claimed_at: null,
    };

    const { data, error } = await supabase
      .from("vibes")
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error("[Supabase] Create error:", error);
      throw new Error(`Failed to create vibe: ${error.message}`);
    }

    return rowToRecord(data as VibeRow);
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("vibes")
      .select()
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      console.error("[Supabase] GetById error:", error);
      throw new Error(`Failed to get vibe: ${error.message}`);
    }

    return data ? rowToRecord(data as VibeRow) : null;
  },

  async update(id: string, updates: Partial<VibeRecord>) {
    const row = recordToRow(updates);

    const { data, error } = await supabase
      .from("vibes")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("[Supabase] Update error:", error);
      throw new Error(`Failed to update vibe: ${error.message}`);
    }

    return data ? rowToRecord(data as VibeRow) : null;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("vibes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Supabase] Delete error:", error);
      throw new Error(`Failed to delete vibe: ${error.message}`);
    }

    console.log(`[Supabase] Deleted vibe: ${id}`);
  },
};
