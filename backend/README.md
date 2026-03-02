# API Backend

Next.js API routes that power the Solana Vibes mobile app. Handles vibe minting, claiming, X OAuth, and Solana transactions.

> **Note**: The primary web app is deployed separately. This is the API-only backend used by the mobile app. Both share the same Supabase database and Solana program.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/vibe/prepare` | Prepare mint transaction for wallet signing |
| POST | `/api/vibe/confirm` | Submit signed mint transaction |
| GET | `/api/vibe/:id` | Get vibe details by ID |
| POST | `/api/vibe/claim/prepare` | Prepare claim transaction |
| POST | `/api/vibe/claim/confirm` | Submit signed claim transaction |
| GET | `/api/vibe/pending/by-username?username=X` | Check pending/claimed vibes for X user |
| GET | `/api/leaderboard?view=week|claimed|most_vibed` | Leaderboard data |
| GET | `/api/auth/x` | Start X OAuth flow |
| GET | `/api/auth/x/callback` | OAuth callback |
| GET | `/api/auth/x/me` | Get authenticated X user |
| GET | `/api/internal/supabase-keepalive` | Internal keepalive endpoint (cron + auth) |

## Structure

```
backend/
├── app/api/              # Next.js API routes
│   ├── auth/x/           # X (Twitter) OAuth
│   ├── vibe/prepare/     # Prepare mint transaction
│   ├── vibe/confirm/     # Confirm mint
│   ├── vibe/[id]/        # Get vibe details
│   ├── vibe/claim/       # Claim flow
│   ├── vibe/pending/     # Check pending vibes
│   └── vibe/image/[id]/  # Vibe image (NFT metadata)
├── lib/
│   ├── solana/           # Solana transaction builders
│   ├── storage/          # Supabase DB + Irys/Arweave storage
│   ├── x-oauth-1.ts      # X OAuth 1.0a
│   └── wallet.ts         # Wallet utilities
└── .env.example          # Required environment variables
```

## Setup

```bash
cd backend
cp .env.example .env   # Fill in values
npm install
npm run dev
```

## Wallets

### Treasury Wallet
**Address**: `Ba2SaKUUQxovZHhJadir27xmTHhQGdV4R8eQ78WqhmFy`

This wallet receives micro-fees from mint and claim transactions. Configured via `TREASURY_WALLET` in `.env`.

**Transferring funds out:**

To transfer SOL from the treasury wallet, you'll need the private key (base58-encoded secret key) for that wallet. You have several options:

1. **Using the provided script** (recommended):
   ```bash
   # Set the treasury private key (base58 encoded)
   TREASURY_SECRET="your-base58-secret-key" npx tsx scripts/transfer-from-treasury.ts <destination-address> <amount-in-sol>
   
   # Example:
   TREASURY_SECRET="..." npx tsx scripts/transfer-from-treasury.ts 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU 1.5
   ```

2. **Using Solana CLI**:
   ```bash
   # Import the keypair
   solana-keygen recover 'prompt://?full-path=/0/0' -o treasury-keypair.json
   
   # Transfer funds
   solana transfer <destination-address> <amount-in-sol> --keypair treasury-keypair.json
   ```

3. **Using a wallet app** (Phantom, Solflare, etc.):
   - Import the treasury wallet using its seed phrase or private key
   - Send SOL to your desired address

**Important**: Store the treasury wallet's private key securely. The `TREASURY_WALLET` in `.env` is only the public address. You'll need the private key to sign transactions.

### Authority Wallet
**Address**: `HBZMHT6YieybD52wEM8FH75fNv4ZdLHtBR82ebfmuAc7`

This is the backend authority wallet that holds NFTs in the vault until they are claimed. It signs transfer transactions when vibes are claimed. The public key is derived from `VIBE_AUTHORITY_SECRET` in `.env`.

To get the authority public key from the secret:
```bash
npx tsx scripts/get-authority-public-key.ts
```

## Deploy

Deploy this `backend/` Next.js app to Vercel (or equivalent). Keep `NEXT_PUBLIC_APP_URL`
aligned with your deployed backend domain so generated links and callbacks are correct.

## Supabase keepalive cron

To reduce idle/sleep behavior on Supabase, this backend includes a daily cron:

- Endpoint: `/api/internal/supabase-keepalive`
- Schedule: daily at `09:00 UTC` (defined in `vercel.json`)
- Security: requires `CRON_SECRET` (checks `Authorization: Bearer <CRON_SECRET>`)

Setup:

1. Add `CRON_SECRET` in Vercel project environment variables.
2. Ensure this backend's `vercel.json` is included in the deployed project.
3. Deploy.

You can manually test with:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-backend-domain>/api/internal/supabase-keepalive
```
