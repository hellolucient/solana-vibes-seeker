/**
 * Dev storage: JSON file on filesystem.
 * TODO: Replace with Supabase (vibes table) and R2 or Supabase Storage for GIFs when moving to production.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { VibeRecord, IVibeStore } from "./types";

// On Vercel the app filesystem is read-only; use /tmp (ephemeral, not shared across instances).
const DATA_DIR =
  process.env.VERCEL === "1" ? path.join("/tmp", "data") : path.join(process.cwd(), "data");
const VIBES_FILE = path.join(DATA_DIR, "vibes.json");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readVibes(): Promise<VibeRecord[]> {
  await ensureDataDir();
  try {
    const raw = await readFile(VIBES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeVibes(vibes: VibeRecord[]) {
  await ensureDataDir();
  await writeFile(VIBES_FILE, JSON.stringify(vibes, null, 2), "utf-8");
}

export const devVibeStore: IVibeStore = {
  async getNextVibeNumber() {
    const vibes = await readVibes();
    return vibes.length + 1;
  },

  async create(vibe) {
    const vibes = await readVibes();
    const record: VibeRecord = {
      ...vibe,
      createdAt: new Date().toISOString(),
      claimStatus: "pending",
    };
    vibes.push(record);
    await writeVibes(vibes);
    return record;
  },

  async getById(id: string) {
    const vibes = await readVibes();
    return vibes.find((v) => v.id === id) ?? null;
  },

  async update(id: string, updates: Partial<VibeRecord>) {
    const vibes = await readVibes();
    const index = vibes.findIndex((v) => v.id === id);
    if (index === -1) return null;

    vibes[index] = { ...vibes[index], ...updates };
    await writeVibes(vibes);
    return vibes[index];
  },

  async delete(id: string) {
    const vibes = await readVibes();
    const filtered = vibes.filter((v) => v.id !== id);
    await writeVibes(filtered);
  },
};
