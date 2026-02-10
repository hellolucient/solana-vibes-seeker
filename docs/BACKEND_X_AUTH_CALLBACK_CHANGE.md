# Backend change for mobile-first X auth

In your **solana-vibes** repo, in `app/api/auth/X/callback/route.ts`, replace the success redirect section.

**Find this block (around the "Successfully authenticated" log):**

```ts
    console.log(`[OAuth1] Successfully authenticated @${accessToken.screen_name}`);

    // Store user info in cookie (this is all we need - no API calls!)
    const userInfo = JSON.stringify({
      id: accessToken.user_id,
      username: accessToken.screen_name,
    });

    const res = NextResponse.redirect(new URL(returnTo, req.url));
```

**Replace with:**

```ts
    console.log(`[OAuth1] Successfully authenticated @${accessToken.screen_name}`);

    // Store user info in cookie (this is all we need - no API calls!)
    const userInfo = JSON.stringify({
      id: accessToken.user_id,
      username: accessToken.screen_name,
    });

    // If redirecting to app deep link, append username so app doesn't need /me
    const isAppDeepLink = returnTo.startsWith("solanavibes://");
    const redirectUrl =
      isAppDeepLink && accessToken.screen_name
        ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}username=${encodeURIComponent(accessToken.screen_name)}`
        : returnTo;

    const res = NextResponse.redirect(new URL(redirectUrl, req.url));
```

Then deploy to Vercel as usual.

**Mobile app flow (no WebView):**  
The app opens `.../api/auth/x?return_to=solanavibes://auth/x` in the **system browser** (Chrome Custom Tabs / SFSafariViewController). After the user authorizes on X, your callback redirects to `solanavibes://auth/x?username=...`, the OS brings the user back to the app, and the app parses the username from the URL. Without the callback change above, the app would reopen but the Connect X button would not show the handle (no username in the link).
