/**
 * Get current X user from cookie (OAuth 1.0a - no API calls!)
 */

import { NextRequest, NextResponse } from "next/server";
import { X_USER_COOKIE } from "@/lib/x-oauth-1";

export async function GET(req: NextRequest) {
  const userCookie = req.cookies.get(X_USER_COOKIE)?.value;

  if (!userCookie) {
    return NextResponse.json({ connected: false });
  }

  try {
    const user = JSON.parse(userCookie);
    
    // User info comes directly from OAuth 1.0a callback - no API call needed!
    return NextResponse.json({
      connected: true,
      id: user.id,
      username: user.username,
    });
  } catch {
    // Invalid cookie format
    return NextResponse.json({ connected: false });
  }
}
