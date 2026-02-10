/**
 * X OAuth 1.0a callback: exchange verifier for access token (includes username!)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAccessToken,
  getOAuth1Config,
  X_OAUTH1_TOKEN_COOKIE,
  X_OAUTH1_SECRET_COOKIE,
  X_OAUTH1_RETURN_COOKIE,
  X_USER_COOKIE,
} from "@/lib/x-oauth-1";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const oauthToken = searchParams.get("oauth_token");
  const oauthVerifier = searchParams.get("oauth_verifier");
  const denied = searchParams.get("denied");

  // User denied authorization
  if (denied) {
    console.log("[OAuth1] User denied authorization");
    return NextResponse.redirect(new URL("/?error=x_oauth&message=denied", req.url));
  }

  // Get stored tokens from cookies
  const storedToken = req.cookies.get(X_OAUTH1_TOKEN_COOKIE)?.value;
  const storedSecret = req.cookies.get(X_OAUTH1_SECRET_COOKIE)?.value;
  const returnTo = req.cookies.get(X_OAUTH1_RETURN_COOKIE)?.value || "/";

  // Validate callback
  if (!oauthToken || !oauthVerifier || !storedToken || !storedSecret) {
    console.error("[OAuth1] Invalid callback - missing params or cookies");
    return NextResponse.redirect(new URL("/?error=x_oauth&message=invalid_callback", req.url));
  }

  // Verify token matches
  if (oauthToken !== storedToken) {
    console.error("[OAuth1] Token mismatch");
    return NextResponse.redirect(new URL("/?error=x_oauth&message=token_mismatch", req.url));
  }

  try {
    const config = getOAuth1Config();

    // Exchange for access token - this includes user_id and screen_name!
    const accessToken = await getAccessToken(
      config,
      storedToken,
      storedSecret,
      oauthVerifier
    );

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

    // Set user cookie (this is all we need - no API calls!)
    res.cookies.set(X_USER_COOKIE, userInfo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Clean up temporary cookies
    res.cookies.delete(X_OAUTH1_TOKEN_COOKIE);
    res.cookies.delete(X_OAUTH1_SECRET_COOKIE);
    res.cookies.delete(X_OAUTH1_RETURN_COOKIE);

    return res;
  } catch (error) {
    console.error("[OAuth1] Access token exchange failed:", error);
    const message = error instanceof Error ? error.message : "exchange_failed";
    return NextResponse.redirect(
      new URL(`/?error=x_oauth&message=${encodeURIComponent(message)}`, req.url)
    );
  }
}
