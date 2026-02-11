/**
 * Short-lived signed token for X auth — used when cookies don't persist (e.g. iOS Safari).
 * Passed in URL after OAuth callback, verified by claim/prepare endpoint.
 */

import crypto from "crypto";

const TOKEN_TTL_SEC = 300; // 5 minutes
const SEP = ".";

function getSecret(): string {
  const secret = process.env.X_AUTH_TOKEN_SECRET || process.env.X_CONSUMER_SECRET;
  if (!secret) throw new Error("X_AUTH_TOKEN_SECRET or X_CONSUMER_SECRET required");
  return secret;
}

export function createXAuthToken(username: string): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const payload = `${username}${SEP}${exp}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}${SEP}${sig}`).toString("base64url");
}

export function verifyXAuthToken(token: string): { username: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [username, expStr, sig] = decoded.split(SEP);
    if (!username || !expStr || !sig) return null;
    const exp = parseInt(expStr, 10);
    if (Date.now() / 1000 > exp) return null; // expired
    const payload = `${username}${SEP}${expStr}`;
    const expectedSig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex").slice(0, 16);
    if (sig !== expectedSig) return null;
    return { username };
  } catch {
    return null;
  }
}
