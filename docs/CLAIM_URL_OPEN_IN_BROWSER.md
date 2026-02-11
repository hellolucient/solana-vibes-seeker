# Claim URL: App First, Browser Fallback

## Goal

When someone taps a claim link (e.g. from an X post):

- **App installed** → open in Solana Vibes app
- **App NOT installed** → open in system browser (Safari on iOS, Chrome on Android)

This gives a better experience than opening in X’s in-app browser, which has cookie/OAuth issues.

## How It Works

### Android (App Links)

The claim URL is `https://solana-vibes-seeker.vercel.app/v/{id}`. Android’s [App Links](https://developer.android.com/training/app-links) use this flow:

1. User taps the link (from X, Messages, etc.)
2. Android checks `assetlinks.json` on the domain
3. If verified and the app is installed → open the app
4. If the app is **not** installed → open in the default browser (Chrome)

Chrome handles X OAuth reliably, unlike X’s in-app browser.

**Setup:** `/.well-known/assetlinks.json` is served from the backend at `solana-vibes-seeker.vercel.app`. The Android app has `android:autoVerify="true"` on the intent filter for `/v/` paths.

### iOS (Universal Links)

For Universal Links to work you need:

1. An iOS app with the Associated Domains entitlement
2. `apple-app-site-association` on the domain
3. User taps an HTTPS link to your domain

Then:

- App installed → open the app  
- App not installed → open in Safari  

Right now this project is Android-only, so iOS users always see the web claim page. When opened from X on iOS, that page loads in X’s in-app browser, which has the OAuth issues described in `IOS_X_AUTH_FIX.md`.

If you add an iOS app:

- Add `applinks:solana-vibes-seeker.vercel.app` to Associated Domains
- Serve `apple-app-site-association` at `/.well-known/apple-app-site-association`

## Shared URL Format

The shared URL should stay as the web URL:

```
https://solana-vibes-seeker.vercel.app/v/{vibeId}
```

**Do not** share `solanavibes://claim/{id}` — custom schemes are often blocked or ignored when shared on X. The HTTPS URL works for both app (via App Links) and web fallback.

## Verifying Android App Links

1. Deploy the backend so `https://solana-vibes-seeker.vercel.app/.well-known/assetlinks.json` is live.

2. Use Google’s tester:  
   https://developers.google.com/digital-asset-links/tools/generator

3. Or install the app and tap a claim link from another app (e.g. Notes). If the app opens, App Links are working.

## Adding New Signing Keys

If you change the app’s signing certificate, add the new SHA-256 fingerprint to `assetlinks.json`:

```bash
# Release keystore
keytool -list -v -keystore android/app/solana-vibes-release.keystore \
  -alias solana-vibes -storepass solanavibes2026 -keypass solanavibes2026 | \
  grep "SHA256:" | sed 's/.*SHA256: //' | tr -d ':'
```

Add the output to `sha256_cert_fingerprints` in `backend/public/.well-known/assetlinks.json`.
