# Mint: "Transaction did not pass signature verification"

## Symptom

When sending a vibe (minting), the confirm step may return:

```
Simulation failed.
Message: Transaction simulation failed: Transaction did not pass signature verification.
```

## Causes

1. **Flaky RPC simulation** — Some RPC nodes reject valid transactions during preflight simulation. The actual transaction would succeed on-chain.

2. **Network mismatch** — The app and backend must use the same cluster:
   - App `cluster` (walletStore) defaults to `mainnet-beta`
   - Backend uses `NEXT_PUBLIC_SOLANA_RPC` (defaults to devnet)
   - If the app is on mainnet and the backend is on devnet (or vice versa), transactions will fail.

3. **Wallet / signer mismatch** — The connected wallet must match the `senderWallet` passed to prepare. Rare if using the same session.

## Current implementation

- **skipPreflight: false** on `sendRawTransaction` in `backend/app/api/vibe/confirm/route.ts`.
- **maxDuration: 90** is enabled for the confirm route.
- **90s polling** is used for confirmation with `searchTransactionHistory: true`.
- **No explicit compute priority fee** is currently set in the mint tx builder.

## Notes

If signature verification errors reappear with specific RPC providers, the main options are:

1. switch to a more reliable mainnet RPC,
2. temporarily test with preflight disabled, or
3. add compute unit price/limit for priority fees in the transaction builder.

## Network alignment

Ensure production backend has:

```bash
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
# or a mainnet RPC (Helius, QuickNode, etc.)
```

The mobile app uses `cluster: 'mainnet-beta'` by default. If the backend is on devnet, mint transactions will fail.
