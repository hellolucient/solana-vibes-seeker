# Solana Vibes: Product Overview

This doc explains what a "vibe" is, how sending/claiming works, and what each leaderboard view means.

## What is a vibe?

A vibe is a unique NFT on Solana that is sent to an X username.

- A sender mints the vibe from their wallet.
- The NFT is held in the app's vault wallet until the recipient claims.
- The recipient claims by proving their X identity and signing a claim transaction with their wallet.

In short: send now, claim later.

## Core rules

- One vibe per sender wallet per recipient `@username`.
- A claim is allowed only for the same X username the vibe was created for.
- A recipient can claim one or multiple pending vibes (oldest first in multi-claim).

## How to send a vibe

1. Connect wallet.
2. Connect X.
3. Enter (or search) the target X username.
4. Sign the mint transaction.
5. Share the claim link.

## How to claim a vibe

1. Open the claim link.
2. Connect wallet.
3. Connect X (must match the vibe's target username).
4. Confirm claim and sign transaction.
5. NFT is transferred from vault to recipient wallet.

## Fees (current defaults)

Platform micro-fees configured in backend:

- Mint fee: `0.002 SOL`
- Claim fee: `0.001 SOL` per NFT

Users also pay normal Solana network costs (and mint account/rent costs on send).

## What appears on the NFT image

Each vibe image is generated as a square `1080x1080` PNG with fixed overlay text.

- Top-left: recipient handle (for example `@trent`)
- Top-right: global vibe number (for example `#123`)
- Bottom terminal block:
  - `> received solana_vibes`
  - `> verified by wallet <masked sender wallet>`
  - `> mint <masked mint address>`
  - `<UTC timestamp>`
  - `> for @<recipient>`
- Bottom-right: recipient-specific ordinal vibe count (for example `3rd vibe`)

## What appears in NFT metadata

The metadata JSON includes:

- `name`: `Vibe #<global_number> for @<recipient>` (when global number is available)
- `description`: includes recipient handle and masked sender wallet
- `external_url`: claim/detail page URL (`/v/{vibeId}`)
- `image`: final uploaded image URL
- `attributes`:
  - `Vibe Number (global)` (example: `#123`)
  - `Recipient` (example: `@trent`)
  - `Sender Wallet` (masked)
  - `Mint` (full mint address)
  - `Created` (ISO timestamp)
  - `Recipient Vibe` (example: `3rd vibe`, when available)

## Leaderboards: what each view means

### `week` (Vibers this week)

- Aggregates minted vibes by sender wallet.
- Time window is the current UTC week:
  - starts Monday `00:00:00` UTC
  - ends next Monday `00:00:00` UTC (Mon-Sun week)
- Shows:
  - total vibes sent in that week
  - how many of those have been claimed (`claimedCount`)

### `claimed`

- All-time leaderboard by sender wallet.
- Counts vibes that have been claimed (not just minted).

### `most_vibed`

- All-time leaderboard by recipient username (`@username`).
- Counts how many vibes each username has received.
- Also includes claimed subset count.

## Useful terms

- **Pending vibe**: minted, but not yet claimed by recipient.
- **Claimed vibe**: successfully transferred to recipient wallet.
- **Vault**: backend-controlled holding wallet used before claim.
