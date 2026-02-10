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
| GET | `/api/auth/x` | Start X OAuth flow |
| GET | `/api/auth/x/callback` | OAuth callback |
| GET | `/api/auth/x/me` | Get authenticated X user |

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

## Deploy

Currently deployed to Vercel via the `solana_vibes` webapp repo. The new `by-username` endpoint needs to be added there — see `app/api/vibe/pending/by-username/route.ts`.
