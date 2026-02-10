/**
 * X (Twitter) OAuth 1.0a Authentication
 * 
 * Key advantage: Returns user_id and screen_name directly in access token response.
 * No additional API calls needed = no rate limits for user verification!
 */

import OAuth from "oauth-1.0a";
import crypto from "crypto";

const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const AUTHORIZE_URL = "https://api.twitter.com/oauth/authorize";
const ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token";

// Cookie names
export const X_OAUTH1_TOKEN_COOKIE = "x_oauth1_token";
export const X_OAUTH1_SECRET_COOKIE = "x_oauth1_secret";
export const X_OAUTH1_RETURN_COOKIE = "x_oauth1_return";
export const X_USER_COOKIE = "x_user";

interface OAuth1Config {
  consumerKey: string;
  consumerSecret: string;
  callbackUrl: string;
}

interface RequestTokenResponse {
  oauth_token: string;
  oauth_token_secret: string;
  oauth_callback_confirmed: string;
}

export interface AccessTokenResponse {
  oauth_token: string;
  oauth_token_secret: string;
  user_id: string;
  screen_name: string;  // This is what we need - no API call required!
}

function createOAuthClient(consumerKey: string, consumerSecret: string): OAuth {
  return new OAuth({
    consumer: {
      key: consumerKey,
      secret: consumerSecret,
    },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

/**
 * Step 1: Get a request token from Twitter
 * 
 * For OAuth 1.0a, the oauth_callback must be included in the signature base string
 * and sent in the Authorization header.
 */
export async function getRequestToken(config: OAuth1Config): Promise<RequestTokenResponse> {
  // Generate OAuth parameters manually for full control
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  
  const oauthParams: Record<string, string> = {
    oauth_callback: config.callbackUrl,
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_version: "1.0",
  };

  // Create signature base string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
    .join("&");

  const signatureBaseString = [
    "POST",
    encodeURIComponent(REQUEST_TOKEN_URL),
    encodeURIComponent(paramString),
  ].join("&");

  // Create signing key (consumer secret + "&" + token secret, but no token yet)
  const signingKey = `${encodeURIComponent(config.consumerSecret)}&`;

  // Generate signature
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  oauthParams.oauth_signature = signature;

  // Build Authorization header
  const authHeader = "OAuth " + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(", ");

  console.log("[OAuth1] Requesting token...");
  console.log("[OAuth1] Consumer Key:", config.consumerKey.substring(0, 8) + "...");

  const response = await fetch(REQUEST_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[OAuth1] Request token failed:", response.status, text);
    throw new Error(`Request token failed: ${response.status} - ${text}`);
  }

  const text = await response.text();
  console.log("[OAuth1] Got request token");
  const params = new URLSearchParams(text);

  return {
    oauth_token: params.get("oauth_token") || "",
    oauth_token_secret: params.get("oauth_token_secret") || "",
    oauth_callback_confirmed: params.get("oauth_callback_confirmed") || "",
  };
}

/**
 * Step 2: Get the authorization URL to redirect the user to
 */
export function getAuthorizeUrl(oauthToken: string): string {
  return `${AUTHORIZE_URL}?oauth_token=${oauthToken}`;
}

/**
 * Step 3: Exchange the verifier for an access token (includes user info!)
 */
export async function getAccessToken(
  config: OAuth1Config,
  oauthToken: string,
  oauthTokenSecret: string,
  oauthVerifier: string
): Promise<AccessTokenResponse> {
  const oauth = createOAuthClient(config.consumerKey, config.consumerSecret);

  const requestData = {
    url: ACCESS_TOKEN_URL,
    method: "POST" as const,
  };

  const token = {
    key: oauthToken,
    secret: oauthTokenSecret,
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  const response = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      ...authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `oauth_verifier=${encodeURIComponent(oauthVerifier)}`,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[OAuth1] Access token failed:", response.status, text);
    throw new Error(`Access token failed: ${response.status} - ${text}`);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  const result = {
    oauth_token: params.get("oauth_token") || "",
    oauth_token_secret: params.get("oauth_token_secret") || "",
    user_id: params.get("user_id") || "",
    screen_name: params.get("screen_name") || "",  // Username - no API call needed!
  };

  console.log(`[OAuth1] Authenticated as @${result.screen_name} (${result.user_id})`);

  return result;
}

/**
 * Get OAuth 1.0a config from environment
 */
export function getOAuth1Config(): OAuth1Config {
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  const callbackUrl = process.env.X_CALLBACK_URL;

  if (!consumerKey || !consumerSecret || !callbackUrl) {
    throw new Error("Missing X_CONSUMER_KEY, X_CONSUMER_SECRET, or X_CALLBACK_URL");
  }

  return { consumerKey, consumerSecret, callbackUrl };
}
