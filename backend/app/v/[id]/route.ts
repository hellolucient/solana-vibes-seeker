/**
 * App-link landing page for vibe claim URLs.
 *
 * When a user clicks a claim link (e.g. https://solana-vibes-seeker.vercel.app/v/h48gczjm):
 *   1. If the Solana Vibes app is installed, Android intercepts the URL and opens
 *      the app directly (via universal link / intent filter).
 *   2. If the app is NOT installed, the URL opens in the browser and hits this route.
 *      We attempt to open via the custom scheme (solanavibes://claim/{id}) and show
 *      a fallback landing page explaining how to get the app.
 */

import { NextRequest, NextResponse } from "next/server";
import { vibeStore } from "@/lib/storage/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try to fetch vibe details for a richer landing page
  let vibeInfo = "";
  try {
    const vibe = await vibeStore.getById(id);
    if (vibe) {
      const recipient = vibe.recipientXUsername
        ? `@${vibe.recipientXUsername}`
        : "someone special";
      vibeInfo = `<p class="vibe-info">A vibe was sent to <strong>${recipient}</strong></p>`;
    }
  } catch {
    // If we can't fetch vibe details, that's fine — show generic page
  }

  const deepLink = `solanavibes://claim/${id}`;
  const githubUrl = "https://github.com/hellolucient/solana-vibes-seeker";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Solana Vibes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #050505;
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #14F195;
    }
    .subtitle {
      font-size: 14px;
      color: #888888;
      margin-bottom: 24px;
    }
    .vibe-info {
      font-size: 16px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 24px;
      padding: 16px;
      background: rgba(20,241,149,0.08);
      border: 1px solid rgba(20,241,149,0.15);
      border-radius: 12px;
    }
    .vibe-info strong {
      color: #14F195;
    }
    .open-btn {
      display: inline-block;
      padding: 14px 32px;
      background: #14F195;
      color: #0a0a0a;
      font-size: 16px;
      font-weight: 700;
      border-radius: 12px;
      text-decoration: none;
      margin-bottom: 16px;
      transition: opacity 0.2s;
    }
    .open-btn:hover { opacity: 0.9; }
    .divider {
      color: #666666;
      font-size: 13px;
      margin: 16px 0;
    }
    .get-app {
      display: inline-block;
      padding: 12px 28px;
      background: #1a1a1a;
      border: 1px solid #333333;
      color: rgba(255,255,255,0.7);
      font-size: 14px;
      font-weight: 500;
      border-radius: 12px;
      text-decoration: none;
      transition: border-color 0.2s, color 0.2s;
    }
    .get-app:hover { border-color: #14F195; color: #ffffff; }
    .footer {
      margin-top: 32px;
      font-size: 12px;
      color: rgba(255,255,255,0.3);
    }
    .footer span {
      color: #9F6AFF;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">✨</div>
    <h1>Solana Vibes</h1>
    <p class="subtitle">Mobile-first NFT vibes on Solana</p>
    ${vibeInfo}
    <a href="${deepLink}" class="open-btn">Open in App</a>
    <p class="divider">Don't have the app yet?</p>
    <a href="${githubUrl}/releases" class="get-app">Get Solana Vibes for Android</a>
    <p class="footer">Built for <span>Solana Mobile</span></p>
  </div>
  <script>
    // Attempt to open the app automatically via custom scheme
    setTimeout(function() {
      window.location.href = "${deepLink}";
    }, 100);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
