/**
 * Start X OAuth 1.0a: get request token, redirect to Twitter authorization
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getRequestToken,
  getAuthorizeUrl,
  getOAuth1Config,
  X_OAUTH1_TOKEN_COOKIE,
  X_OAUTH1_SECRET_COOKIE,
  X_OAUTH1_RETURN_COOKIE,
} from "@/lib/x-oauth-1";

export async function GET(req: NextRequest) {
  try {
    const config = getOAuth1Config();
    
    // Capture return URL from query param
    const returnTo = req.nextUrl.searchParams.get("return_to") || "/";

    // Step 1: Get request token from Twitter
    const requestToken = await getRequestToken(config);
    
    if (!requestToken.oauth_token || !requestToken.oauth_token_secret) {
      throw new Error("Invalid request token response");
    }

    // Step 2: Build authorization URL
    const authorizeUrl = getAuthorizeUrl(requestToken.oauth_token);

    console.log("[OAuth1] Redirecting to Twitter authorization");

    // Step 3: Store tokens in cookies and redirect
    const res = NextResponse.redirect(authorizeUrl);
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600, // 10 minutes
    };

    res.cookies.set(X_OAUTH1_TOKEN_COOKIE, requestToken.oauth_token, cookieOpts);
    res.cookies.set(X_OAUTH1_SECRET_COOKIE, requestToken.oauth_token_secret, cookieOpts);
    res.cookies.set(X_OAUTH1_RETURN_COOKIE, returnTo, cookieOpts);

    return res;
  } catch (error) {
    console.error("[OAuth1] Failed to start auth:", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.redirect(
      new URL(`/?error=x_oauth&message=${encodeURIComponent(message)}`, req.url)
    );
  }
}
