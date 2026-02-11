# iOS Safari X OAuth Fix

On iOS Safari (and some other mobile browsers), cookies set during the OAuth redirect may not persist due to Intelligent Tracking Prevention (ITP) or cookie isolation.

## What we did

1. **Signed token fallback**  
   After X OAuth succeeds, the callback redirects to `/v/{id}?x=TOKEN` instead of only `/v/{id}`. The token is a short-lived (5 min) signed payload containing the username.

2. **Prepare endpoint**  
   The claim prepare API accepts either:
   - `x` (signed token) – used when the cookie didn’t persist
   - `xUsername` (mobile app)
   - Cookie (when it does persist)

3. **Client**  
   On load, the claim page checks for `?x=` in the URL. If present, it stores the token and sends it with the prepare request, so claiming works even when the cookie is missing.

## Env

The token is signed with `X_AUTH_TOKEN_SECRET` or, if unset, `X_CONSUMER_SECRET`. No extra env var is required if `X_CONSUMER_SECRET` is already set.

## Troubleshooting

- **Links opened from X** load in X's in-app browser, which has its own isolated cookie storage (does not share with Safari or the X app). So when you tap "Connect X", the OAuth screen does *not* show you as already logged in—you must sign in again in that browser. **Safari** shares cookies with the system, so if you're logged into X in Safari, the OAuth screen will show you as logged in. For the best experience, open the claim link in Safari.
- **App Links / Universal Links**: We prefer links to open in the app (if installed) or the system browser (if not). See `CLAIM_URL_OPEN_IN_BROWSER.md` for how this is set up. On Android, App Links will open Chrome when the app isn't installed, which avoids X's in-app browser.
- **Twitter callback URL** must exactly match: `https://solana-vibes-seeker.vercel.app/api/auth/x/callback` (or your production URL) in the Twitter Developer Portal.

## Phantom wallet on mobile Safari

When connecting Phantom from Safari on iOS, the redirect back from Phantom can leave the wallet "not connected" on our page. Use **Open in Phantom** instead: it opens the claim page inside Phantom's in-app browser, where the wallet is natively available and connects reliably.

## Wallet-first flow when opened from X on iOS

When the claim link is opened in X's in-app browser on iOS, we show only **Connect wallet** on the initial screen. Tapping it opens the claim page in Phantom's browser, where both wallet and X tend to work reliably (Phantom shares session/cookies better). Once in Phantom, the full claim flow (Connect X if needed, then claim) is shown.
