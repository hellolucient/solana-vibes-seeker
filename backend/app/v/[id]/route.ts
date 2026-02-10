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
      const recipient = vibe.targetUsername
        ? `@${vibe.targetUsername}`
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
  <title>solana_vibes</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'JetBrains Mono', monospace;
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
    h1 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 400;
      margin-bottom: 12px;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 400;
      color: #00ff00;
      margin-bottom: 32px;
      letter-spacing: 0.5px;
    }
    .vibe-info {
      font-size: 14px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 28px;
      padding: 14px 18px;
      background: rgba(20,241,149,0.06);
      border: 1px solid rgba(20,241,149,0.12);
      border-radius: 8px;
    }
    .vibe-info strong {
      color: #14F195;
    }
    .open-btn {
      display: inline-block;
      padding: 10px 28px;
      background: transparent;
      color: #14F195;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 500;
      border: 1px solid rgba(20,241,149,0.3);
      border-radius: 6px;
      text-decoration: none;
      margin-bottom: 16px;
      transition: all 0.2s;
      letter-spacing: 0.3px;
    }
    .open-btn:hover {
      background: rgba(20,241,149,0.08);
      border-color: #14F195;
    }
    .divider {
      color: rgba(255,255,255,0.25);
      font-size: 12px;
      margin: 20px 0;
    }
    .get-app {
      display: inline-block;
      padding: 10px 24px;
      background: transparent;
      border: 1px solid #333333;
      color: rgba(255,255,255,0.5);
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 400;
      border-radius: 6px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .get-app:hover { border-color: rgba(255,255,255,0.4); color: #ffffff; }
    .footer {
      margin-top: 40px;
      font-size: 11px;
      color: rgba(255,255,255,0.2);
    }
    .footer span {
      color: rgba(159,106,255,0.5);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>solana_vibes</h1>
    <p class="tagline">mint vibe &middot; share vibe &middot; claim vibe</p>
    ${vibeInfo}
    <a href="${deepLink}" class="open-btn">&gt; open in app</a>
    <p class="divider">don't have the app yet?</p>
    <a href="${githubUrl}/releases" class="get-app">get solana_vibes for android</a>
    <p class="footer">built for <span>solana mobile</span></p>
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
