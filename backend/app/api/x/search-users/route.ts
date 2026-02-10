/**
 * X user search (typeahead). Requires valid X OAuth token.
 */

import { NextRequest, NextResponse } from "next/server";
import { X_OAUTH_COOKIE } from "@/lib/x-oauth";

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(X_OAUTH_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated with X" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 3) {
    return NextResponse.json({ users: [] });
  }

  const username = query.replace(/^@/, "").trim();
  if (!username) return NextResponse.json({ users: [] });

  // X API v2: single user by username — GET /2/users/by/username/:username
  const url = `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=profile_image_url`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[X search-users] Twitter API ${res.status} for @${username}:`, err);
    const status = res.status === 401 ? 401 : res.status === 429 ? 429 : 502;
    const message =
      res.status === 429
        ? "Too many searches. Please wait a moment and try again."
        : "X API error";
    return NextResponse.json({ error: message, details: err }, { status });
  }

  const data = (await res.json()) as {
    data?: { id: string; username: string; name?: string; profile_image_url?: string };
  };
  const user = data.data;
  const users = user
    ? [
        {
          id: user.id,
          username: user.username,
          name: user.name ?? "",
          profile_image_url: user.profile_image_url ?? "",
        },
      ]
    : [];

  return NextResponse.json({ users });
}
