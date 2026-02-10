/**
 * Wallet masking: first 3 + … + last 3 (ellipsis character)
 */

export function maskWallet(base58: string): string {
  if (!base58 || base58.length < 7) return base58;
  return `${base58.slice(0, 3)}…${base58.slice(-3)}`;
}
