# X auth callback behavior (current)

This repo already includes the mobile callback behavior in:

- `backend/app/api/auth/x/callback/route.ts`

## What it does

- Stores authenticated X user in cookie.
- Preserves `return_to` behavior.
- If `return_to` is an app deep link (`solanavibes://...`), appends
  `username=...` so the mobile app can immediately show connected state.
- For claim-page web redirects, supports the signed `?x=...` token fallback
  used by iOS/Safari cookie edge cases.

## Mobile flow used today

- The app opens X auth via the in-app auth webview component.
- OAuth callback redirects to `solanavibes://auth/x?username=...` when needed.
- The app reads `username` from the deep link and stores it locally.
