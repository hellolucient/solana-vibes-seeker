/**
 * X (Twitter) OAuth 2.0 Authorization Code with PKCE.
 * Only for user lookup/search — no tweet posting.
 */

import { createHash, randomBytes } from "crypto";

const X_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_USER_ME = "https://api.twitter.com/2/users/me?user.fields=profile_image_url";

export const X_OAUTH_SCOPES = "users.read tweet.read offline.access";
export const X_OAUTH_COOKIE = "x_access_token";
export const X_OAUTH_STATE_COOKIE = "x_oauth_state";
export const X_OAUTH_VERIFIER_COOKIE = "x_oauth_verifier";
export const X_OAUTH_RETURN_COOKIE = "x_oauth_return";

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const hash = createHash("sha256").update(codeVerifier, "utf8").digest();
  const codeChallenge = base64UrlEncode(hash);
  return { codeVerifier, codeChallenge };
}

export function getAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: X_OAUTH_SCOPES,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTH_URL}?${q.toString()}`;
}

export async function exchangeCode(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  clientSecret?: string;
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const body = new URLSearchParams({
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  const auth =
    params.clientSecret != null
      ? Buffer.from(`${params.clientId}:${params.clientSecret}`).toString("base64")
      : params.clientId;
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X token exchange failed: ${res.status} ${err}`);
  }
  const tokenData = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  console.log(`[X OAuth] Token exchange successful. Scopes granted:`, tokenData.scope || "none");
  return tokenData;
}

export async function getXUser(accessToken: string): Promise<{
  id: string;
  username: string;
  name?: string;
  profile_image_url?: string;
}> {
  const res = await fetch(X_USER_ME, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errorText = await res.text();
    let errorJson: any = {};
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // Not JSON, use raw text
    }
    console.error(`[X OAuth] /users/me failed ${res.status}:`, errorText);
    console.error(`[X OAuth] Error details:`, errorJson);
    throw new Error(`X user me failed: ${res.status} - ${errorJson.detail || errorText}`);
  }
  const data = (await res.json()) as { data?: { id: string; username: string; name?: string; profile_image_url?: string } };
  if (!data.data) throw new Error("No user data");
  return data.data;
}
