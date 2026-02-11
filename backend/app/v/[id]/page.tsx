import { Metadata } from "next";
import { ClaimPageClient } from "./ClaimPageClient";
import { vibeStore } from "@/lib/storage/supabase";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solana-vibes-seeker.vercel.app";
  const ogImage = `${baseUrl}/media/vibes-base.png`;

  try {
    const vibe = await vibeStore.getById(id);
    if (vibe?.targetUsername) {
      return {
        title: `solana_vibes – for @${vibe.targetUsername}`,
        description: `A vibe was sent to @${vibe.targetUsername}. Claim yours.`,
        openGraph: {
          title: `solana_vibes – for @${vibe.targetUsername}`,
          description: `A vibe was sent to @${vibe.targetUsername}. Claim yours.`,
          images: [{ url: ogImage, width: 1200, height: 630 }],
        },
        twitter: {
          card: "summary_large_image",
          title: `solana_vibes – for @${vibe.targetUsername}`,
          description: `A vibe was sent to @${vibe.targetUsername}. Claim yours.`,
          images: [ogImage],
        },
      };
    }
  } catch {
    // Ignore
  }

  return {
    title: "solana_vibes – claim your vibe",
    openGraph: {
      title: "solana_vibes – claim your vibe",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "solana_vibes – claim your vibe",
      images: [ogImage],
    },
  };
}

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClaimPageClient vibeId={id} />;
}
