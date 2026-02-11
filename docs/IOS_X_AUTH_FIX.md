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
