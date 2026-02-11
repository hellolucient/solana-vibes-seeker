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
- **Twitter callback URL** must exactly match: `https://solana-vibes-seeker.vercel.app/api/auth/x/callback` (or your production URL) in the Twitter Developer Portal.
