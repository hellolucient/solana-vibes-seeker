/**
 * Logout: clear X user cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { X_USER_COOKIE } from "@/lib/x-oauth-1";

export async function POST(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
  
  const res = NextResponse.redirect(new URL(returnTo, req.url));
  res.cookies.delete(X_USER_COOKIE);
  
  return res;
}

// Also support GET for simple logout links
export async function GET(req: NextRequest) {
  return POST(req);
}
