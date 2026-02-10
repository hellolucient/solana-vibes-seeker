/**
 * Short unique vibe ID (URL-safe, no ambiguous chars).
 */

const CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0,O,1,l,I

export function generateVibeId(): string {
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    id += CHARS[bytes[i]! % CHARS.length];
  }
  return id;
}
