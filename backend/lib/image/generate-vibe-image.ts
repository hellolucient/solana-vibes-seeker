/**
 * Generate vibe static image: base PNG + text overlays.
 * Uses satori + resvg-js for reliable text rendering on Vercel.
 * Base asset: public/media/vibes-base.png
 * 
 * Text elements rendered on the image:
 * - Top-left: @handle (subtle semi-transparent gray)
 * - Top-right: Global vibe #N (total vibes minted across app)
 * - Middle area: Faint binary decoration (101010...)
 * - Bottom: Footer with vibe info (green terminal style)
 * - Bottom-right: Nth vibe for this @username (e.g. #3 = 3rd vibe sent to that handle)
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import sharp from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const BASE_IMAGE_PATH = path.join(process.cwd(), "public", "media", "vibes-base.png");
const FONT_PATH = path.join(process.cwd(), "lib", "fonts", "JetBrainsMono-Regular.ttf");
const HANDLE_FONT_PATH = path.join(process.cwd(), "lib", "fonts", "Montserrat-Black.ttf");

// Styling constants
const FONT_SIZE = 14;
const FONT_SIZE_BINARY = 12;
const FONT_SIZE_CORNER = 18; // Username font size
const PADDING = 16;
const LINE_HEIGHT = 18;
const FOOTER_COLOR = "#00ff00";
const BINARY_COLOR = "rgba(0, 255, 0, 0.06)"; // Very faint green for binary decoration
const SUBTLE_GRAY = "rgba(128, 128, 128, 0.25)"; // Subtle gray for corner text

/** Standard NFT display size; many wallets (e.g. Phantom) show square and can crop non-square images. */
export const NFT_OUTPUT_SIZE = 1080;

/** Fixed dimensions for compositing so overlays never exceed base (avoids Vercel/Sharp errors). */
const COMPOSITE_BASE_SIZE = NFT_OUTPUT_SIZE;

// Cache the font data
let fontData: Buffer | null = null;
function getFontData(): Buffer {
  if (!fontData) {
    fontData = readFileSync(FONT_PATH);
  }
  return fontData;
}

// Cache for handle font (Montserrat Black)
let handleFontData: Buffer | null = null;
function getHandleFontData(): Buffer {
  if (!handleFontData) {
    handleFontData = readFileSync(HANDLE_FONT_PATH);
  }
  return handleFontData;
}

export interface GenerateVibeImageOptions {
  maskedWallet: string;
  recipientHandle: string;
  mintAddress: string;
  timestamp: string; // ISO string
  outputPath: string;
  vibeNumber?: number; // Global sequential vibe count (top-right)
  vibeIndexForRecipient?: number; // Nth vibe for this @username (bottom-right)
}

function ensureOutputDir(outputPath: string) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
}

/**
 * Mask a mint address for display: first 4 + … + last 4
 */
function maskMintAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Format timestamp for display.
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

/**
 * Generate footer text overlay using satori.
 */
async function generateFooterOverlay(
  width: number,
  height: number,
  lines: string[]
): Promise<Buffer> {
  const font = getFontData();
  
  // Satori accepts this object format at runtime (JSX-like structure)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        width: "100%",
        height: "100%",
        padding: PADDING,
        fontFamily: "JetBrains Mono",
      },
      children: lines.map((line) => ({
        type: "div",
        props: {
          style: {
            color: FOOTER_COLOR,
            fontSize: FONT_SIZE,
            lineHeight: `${LINE_HEIGHT}px`,
          },
          children: line || " ", // Use space for empty lines to maintain height
        },
      })),
    },
  };

  const svg = await satori(element, {
    width,
    height,
    fonts: [
      {
        name: "JetBrains Mono",
        data: font,
        weight: 400,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    background: "transparent",
    fitTo: {
      mode: "width",
      value: width,
    },
  });
  
  const png = resvg.render().asPng();
  const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);
  return sharp(buf)
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
}

/**
 * Generate subtle corner text overlay (top-left or top-right).
 * Uses Montserrat Black for handle (left) and JetBrains Mono for vibe number (right).
 * Returns PNG buffer sized exactly to width x height for safe compositing.
 */
async function generateCornerOverlay(
  width: number,
  height: number,
  text: string,
  position: "left" | "right"
): Promise<Buffer> {
  // Use Montserrat Black for handle (left), JetBrains Mono for number (right)
  const isHandle = position === "left";
  const fontName = isHandle ? "Montserrat" : "JetBrains Mono";
  const fontData = isHandle ? getHandleFontData() : getFontData();
  const fontWeight = isHandle ? 900 : 400;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = {
    type: "div",
    props: {
      style: {
        display: "flex",
        justifyContent: position === "left" ? "flex-start" : "flex-end",
        alignItems: "flex-start",
        width: "100%",
        height: "100%",
        padding: PADDING,
        fontFamily: fontName,
      },
      children: {
        type: "div",
        props: {
          style: {
            color: SUBTLE_GRAY,
            fontSize: FONT_SIZE_CORNER,
          },
          children: text,
        },
      },
    },
  };

  const svg = await satori(element, {
    width,
    height,
    fonts: [
      {
        name: fontName,
        data: fontData,
        weight: fontWeight,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    background: "transparent",
    fitTo: {
      mode: "width",
      value: width,
    },
  });
  
  const png = resvg.render().asPng();
  const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);
  // Resize to exact dimensions so composite never exceeds base image
  return sharp(buf)
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
}

/**
 * Generate binary decoration overlay using satori.
 */
async function generateBinaryOverlay(width: number, height: number): Promise<Buffer> {
  const font = getFontData();
  
  const binaryLines = [
    "101010110010101101001011",
    "010110101001101010110101",
    "110101010110010101101001",
  ];

  // Satori accepts this object format at runtime (JSX-like structure)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: PADDING,
        fontFamily: "JetBrains Mono",
      },
      children: binaryLines.map((line) => ({
        type: "div",
        props: {
          style: {
            color: BINARY_COLOR,
            fontSize: FONT_SIZE_BINARY,
            lineHeight: `${FONT_SIZE_BINARY + 2}px`,
          },
          children: line,
        },
      })),
    },
  };

  const svg = await satori(element, {
    width,
    height,
    fonts: [
      {
        name: "JetBrains Mono",
        data: font,
        weight: 400,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    background: "transparent",
    fitTo: {
      mode: "width",
      value: width,
    },
  });
  
  const png = resvg.render().asPng();
  const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);
  return sharp(buf)
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
}

/**
 * Generate vibe PNG with all text elements and write to outputPath.
 * Force regenerate (overwrite) since content may change.
 */
export async function generateVibeImage(options: GenerateVibeImageOptions): Promise<Buffer> {
  const { maskedWallet, recipientHandle, mintAddress, timestamp, outputPath, vibeNumber, vibeIndexForRecipient } = options;

  ensureOutputDir(outputPath);
  const t0 = Date.now();

  // Normalize base to fixed size so overlay dimensions never exceed base (fixes Vercel Sharp error)
  const width = COMPOSITE_BASE_SIZE;
  const height = COMPOSITE_BASE_SIZE;
  const baseBuffer = await sharp(BASE_IMAGE_PATH)
    .resize(width, height, { fit: "contain", position: "center", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer();

  // Prepare text content
  const handle = recipientHandle.startsWith("@") ? recipientHandle : `@${recipientHandle}`;
  const maskedMint = maskMintAddress(mintAddress);
  const formattedTime = formatTimestamp(timestamp);
  const vibeNumberText = vibeNumber ? `#${vibeNumber}` : "";
  const vibeIndexText = vibeIndexForRecipient ? `#${vibeIndexForRecipient}` : "";

  // Footer text lines (vibe number removed - now shown in top-right corner)
  const footerLines = [
    "> received solana_vibes",
    `> verified by wallet ${maskedWallet}`,
    `> mint ${maskedMint}`,
    formattedTime,
    "",
    `> for ${handle}`,
  ];

  const footerHeight = LINE_HEIGHT * footerLines.length + PADDING * 2;
  const binaryHeight = (FONT_SIZE_BINARY + 2) * 3 + PADDING * 2;
  const cornerHeight = FONT_SIZE_CORNER + PADDING * 2;

  // Generate overlays using satori (all at most width x height)
  const overlayPromises: Promise<Buffer>[] = [
    generateFooterOverlay(width, footerHeight, footerLines),
    generateBinaryOverlay(width, binaryHeight),
    generateCornerOverlay(width, cornerHeight, handle, "left"), // @handle top-left
  ];
  
  // Only add vibe number overlay if we have a number
  if (vibeNumberText) {
    overlayPromises.push(generateCornerOverlay(width, cornerHeight, vibeNumberText, "right"));
  }
  // Bottom-right: Nth vibe for this @username
  if (vibeIndexText) {
    overlayPromises.push(generateCornerOverlay(width, cornerHeight, vibeIndexText, "right"));
  }

  const overlayResults = await Promise.all(overlayPromises);
  const footerBuffer = overlayResults[0];
  const binaryBuffer = overlayResults[1];
  const handleBuffer = overlayResults[2];
  let vibeNumberBuffer: Buffer | undefined;
  let vibeIndexBuffer: Buffer | undefined;
  let oIdx = 3;
  if (vibeNumberText) vibeNumberBuffer = overlayResults[oIdx++];
  if (vibeIndexText) vibeIndexBuffer = overlayResults[oIdx];

  const composites = [
    // Binary decoration (very faint)
    {
      input: binaryBuffer,
      top: Math.floor(height * 0.35),
      left: 0,
    },
    // @handle at top-left (subtle gray)
    {
      input: handleBuffer,
      top: 0,
      left: 0,
    },
    // Footer overlay at bottom
    {
      input: footerBuffer,
      top: height - footerHeight,
      left: 0,
    },
  ];

  // Add vibe number at top-right if available
  if (vibeNumberBuffer) {
    composites.push({
      input: vibeNumberBuffer,
      top: 0,
      left: 0,
    });
  }
  // Add Nth vibe for recipient at bottom-right
  if (vibeIndexBuffer) {
    composites.push({
      input: vibeIndexBuffer,
      top: height - cornerHeight,
      left: 0,
    });
  }

  // Composite onto normalized base (no final resize needed)
  const outBuffer = await sharp(baseBuffer)
    .composite(composites)
    .png()
    .toBuffer();

  writeFileSync(outputPath, outBuffer);
  console.log(`[vibe/image] Written ${outputPath} (${NFT_OUTPUT_SIZE}x${NFT_OUTPUT_SIZE}) in ${Date.now() - t0}ms`);

  return outBuffer;
}

/**
 * Generate vibe image and return buffer without writing to disk.
 * Useful for direct upload to storage.
 */
export async function generateVibeImageBuffer(
  options: Omit<GenerateVibeImageOptions, "outputPath">
): Promise<Buffer> {
  const { maskedWallet, recipientHandle, mintAddress, timestamp, vibeNumber, vibeIndexForRecipient } = options;
  const t0 = Date.now();

  const width = COMPOSITE_BASE_SIZE;
  const height = COMPOSITE_BASE_SIZE;
  const baseBuffer = await sharp(BASE_IMAGE_PATH)
    .resize(width, height, { fit: "contain", position: "center", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer();

  // Prepare text content
  const handle = recipientHandle.startsWith("@") ? recipientHandle : `@${recipientHandle}`;
  const maskedMint = maskMintAddress(mintAddress);
  const formattedTime = formatTimestamp(timestamp);
  const vibeNumberText = vibeNumber ? `#${vibeNumber}` : "";
  const vibeIndexText = vibeIndexForRecipient ? `#${vibeIndexForRecipient}` : "";

  // Footer text lines (vibe number removed - now shown in top-right corner)
  const footerLines = [
    "> received solana_vibes",
    `> verified by wallet ${maskedWallet}`,
    `> mint ${maskedMint}`,
    formattedTime,
    "",
    `> for ${handle}`,
  ];

  const footerHeight = LINE_HEIGHT * footerLines.length + PADDING * 2;
  const binaryHeight = (FONT_SIZE_BINARY + 2) * 3 + PADDING * 2;
  const cornerHeight = FONT_SIZE_CORNER + PADDING * 2;

  // Generate overlays using satori
  const overlayPromises: Promise<Buffer>[] = [
    generateFooterOverlay(width, footerHeight, footerLines),
    generateBinaryOverlay(width, binaryHeight),
    generateCornerOverlay(width, cornerHeight, handle, "left"), // @handle top-left (Montserrat Black)
  ];
  
  // Only add vibe number overlay if we have a number
  if (vibeNumberText) {
    overlayPromises.push(generateCornerOverlay(width, cornerHeight, vibeNumberText, "right"));
  }
  // Bottom-right: Nth vibe for this @username
  if (vibeIndexText) {
    overlayPromises.push(generateCornerOverlay(width, cornerHeight, vibeIndexText, "right"));
  }

  const overlayResultsBuffer = await Promise.all(overlayPromises);
  const footerBufferB = overlayResultsBuffer[0];
  const binaryBufferB = overlayResultsBuffer[1];
  const handleBufferB = overlayResultsBuffer[2];
  let vibeNumberBufferB: Buffer | undefined;
  let vibeIndexBufferB: Buffer | undefined;
  let oIdxB = 3;
  if (vibeNumberText) vibeNumberBufferB = overlayResultsBuffer[oIdxB++];
  if (vibeIndexText) vibeIndexBufferB = overlayResultsBuffer[oIdxB];

  const compositesBuffer = [
    // Binary decoration (very faint)
    {
      input: binaryBufferB,
      top: Math.floor(height * 0.35),
      left: 0,
    },
    // @handle at top-left (Montserrat Black, subtle gray)
    {
      input: handleBufferB,
      top: 0,
      left: 0,
    },
    // Footer overlay at bottom
    {
      input: footerBufferB,
      top: height - footerHeight,
      left: 0,
    },
  ];

  // Add vibe number at top-right if available
  if (vibeNumberBufferB) {
    compositesBuffer.push({
      input: vibeNumberBufferB,
      top: 0,
      left: 0,
    });
  }
  // Add Nth vibe for recipient at bottom-right
  if (vibeIndexBufferB) {
    compositesBuffer.push({
      input: vibeIndexBufferB,
      top: height - cornerHeight,
      left: 0,
    });
  }

  const outBuffer = await sharp(baseBuffer)
    .composite(compositesBuffer)
    .png()
    .toBuffer();

  console.log(`[vibe/image] Generated buffer (${NFT_OUTPUT_SIZE}x${NFT_OUTPUT_SIZE}) in ${Date.now() - t0}ms`);

  return outBuffer;
}
