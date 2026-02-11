"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import {
  VersionedTransaction,
  Transaction,
} from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
const API_BASE = "";

function deserializeTransaction(base64: string): Transaction | VersionedTransaction {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

function serializeSignedTransaction(tx: Transaction | VersionedTransaction): string {
  const bytes =
    tx instanceof VersionedTransaction
      ? tx.serialize()
      : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const arr = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

interface VibeDetails {
  id: string;
  targetUsername: string;
  senderWallet: string;
  maskedWallet: string;
  vibeNumber: number;
  imageUri?: string;
  claimStatus: "pending" | "claimed";
  mintAddress?: string;
}

type ClaimState =
  | "loading"
  | "ready"
  | "preparing"
  | "signing"
  | "confirming"
  | "success"
  | "error";

function ClaimInner({ vibeId }: { vibeId: string }) {
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const [vibeDetails, setVibeDetails] = useState<VibeDetails | null>(null);
  const [xUser, setXUser] = useState<{ username: string } | null>(null);
  const [claimState, setClaimState] = useState<ClaimState>("loading");
  const [error, setError] = useState<string | null>(null);

  const deepLink = `solanavibes://claim/${vibeId}`;
  const githubUrl = "https://github.com/hellolucient/solana-vibes-seeker";

  // Fetch vibe details and X user
  useEffect(() => {
    async function load() {
      try {
        const [vibeRes, meRes] = await Promise.all([
          fetch(`${API_BASE}/api/vibe/${vibeId}`, { credentials: "include" }),
          fetch(`${API_BASE}/api/auth/x/me`, { credentials: "include" }),
        ]);

        if (!vibeRes.ok) {
          setError("Vibe not found");
          setClaimState("error");
          return;
        }

        const vibe = await vibeRes.json();
        setVibeDetails({ ...vibe, imageUrl: vibe.imageUri || vibe.imageUrl });

        if (meRes.ok) {
          const me = await meRes.json();
          if (me.connected && me.username) {
            setXUser({ username: me.username });
          }
        }

        if (vibe.claimStatus === "claimed") {
          setClaimState("success");
        } else {
          setClaimState("ready");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        setClaimState("error");
      }
    }
    load();
  }, [vibeId]);

  const handleConnectX = useCallback(() => {
    const returnTo = `/v/${vibeId}`;
    window.location.href = `${API_BASE}/api/auth/x?return_to=${encodeURIComponent(returnTo)}`;
  }, [vibeId]);

  const handleClaim = useCallback(async () => {
    if (!publicKey || !vibeDetails || !xUser) {
      setError("Connect X and wallet first");
      return;
    }

    setClaimState("preparing");
    setError(null);

    try {
      const prepareRes = await fetch(`${API_BASE}/api/vibe/claim/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vibeId: vibeDetails.id,
          claimerWallet: publicKey.toBase58(),
        }),
      });

      if (!prepareRes.ok) {
        const errData = await prepareRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to prepare claim");
      }

      const { transaction, blockhash, lastValidBlockHeight } = await prepareRes.json();
      const tx = deserializeTransaction(transaction);
      setClaimState("signing");

      if (!signTransaction) throw new Error("Wallet not connected");
      const signed = await signTransaction(tx);
      if (!signed) throw new Error("Wallet signature required");

      const signedB64 = serializeSignedTransaction(signed);
      setClaimState("confirming");

      const confirmRes = await fetch(`${API_BASE}/api/vibe/claim/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vibeId: vibeDetails.id,
          claimerWallet: publicKey.toBase58(),
          signedTransaction: signedB64,
          blockhash,
          lastValidBlockHeight,
        }),
      });

      if (!confirmRes.ok) {
        const errData = await confirmRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to confirm claim");
      }

      setClaimState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
      setClaimState("ready");
    }
  }, [publicKey, vibeDetails, xUser, signTransaction]);

  if (claimState === "loading" || claimState === "error") {
    return (
      <div style={styles.container}>
        <h1 style={styles.h1}>solana_vibes</h1>
        <p style={styles.tagline}>mint vibe · share vibe · claim vibe</p>
        {error && <p style={styles.error}>{error}</p>}
      </div>
    );
  }

  const recipient = vibeDetails?.targetUsername
    ? `@${vibeDetails.targetUsername}`
    : "someone special";

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>solana_vibes</h1>
      <p style={styles.tagline}>mint vibe · share vibe · claim vibe</p>
      <p style={styles.vibeInfo}>
        A vibe was sent to <strong style={styles.strong}>{recipient}</strong>
      </p>

      {/* App-centric: Open in app */}
      <a href={deepLink} style={styles.openBtn}>
        → open in app
      </a>

      <p style={styles.divider}>or claim in browser</p>

      {/* Web claim flow */}
      {claimState === "success" ? (
        <div style={styles.successBox}>
          <p style={styles.successTitle}>✓ Claimed</p>
          <p style={styles.successSub}>
            {publicKey
              ? `by ${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
              : "Success"}
          </p>
        </div>
      ) : (
        <>
          {!xUser ? (
            <button onClick={handleConnectX} style={styles.secondaryBtn}>
              connect X
            </button>
          ) : (
            <p style={styles.connected}>X: @{xUser.username}</p>
          )}
          {!publicKey ? (
            <button onClick={() => setVisible(true)} style={styles.secondaryBtn}>
              connect wallet
            </button>
          ) : (
            <p style={styles.connected}>
              Wallet: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </p>
          )}
          {error && <p style={styles.error}>{error}</p>}
          <button
            onClick={handleClaim}
            disabled={
              !xUser ||
              !publicKey ||
              claimState === "preparing" ||
              claimState === "signing" ||
              claimState === "confirming"
            }
            style={styles.claimBtn}
          >
            {claimState === "preparing"
              ? "Preparing..."
              : claimState === "signing"
              ? "Sign in wallet..."
              : claimState === "confirming"
              ? "Confirming..."
              : "confirm claim"}
          </button>
          <p style={styles.feeText}>Claim fee: ~0.001 SOL</p>
        </>
      )}

      <p style={styles.divider}>don&apos;t have the app?</p>
      <a href={`${githubUrl}/releases`} style={styles.getApp}>
        get solana_vibes for android
      </a>
      <p style={styles.footer}>built for solana mobile</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'JetBrains Mono', monospace",
    background: "#050505",
    color: "#fff",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    textAlign: "center",
  },
  h1: { fontSize: 28, fontWeight: 400, marginBottom: 12 },
  tagline: { fontSize: 13, color: "#00ff00", marginBottom: 32 },
  vibeInfo: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 28,
    padding: "14px 18px",
    background: "rgba(20,241,149,0.06)",
    border: "1px solid rgba(20,241,149,0.12)",
    borderRadius: 8,
  },
  strong: { color: "#14F195" },
  openBtn: {
    display: "inline-block",
    padding: "10px 28px",
    background: "transparent",
    color: "#14F195",
    fontSize: 14,
    fontWeight: 500,
    border: "1px solid rgba(20,241,149,0.3)",
    borderRadius: 6,
    textDecoration: "none",
    marginBottom: 16,
  },
  divider: { color: "rgba(255,255,255,0.25)", fontSize: 12, margin: "20px 0" },
  secondaryBtn: {
    padding: "10px 24px",
    background: "transparent",
    border: "1px solid #333",
    color: "rgba(255,255,255,0.8)",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    borderRadius: 6,
    cursor: "pointer",
    margin: "8px 0",
  },
  connected: { fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "4px 0" },
  claimBtn: {
    padding: "12px 32px",
    background: "rgba(20,241,149,0.15)",
    border: "1px solid #14F195",
    color: "#14F195",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 6,
    cursor: "pointer",
    marginTop: 12,
  },
  feeText: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8 },
  successBox: {
    padding: 20,
    background: "rgba(20,241,149,0.1)",
    border: "1px solid rgba(20,241,149,0.3)",
    borderRadius: 8,
    marginBottom: 16,
  },
  successTitle: { color: "#14F195", fontSize: 18, fontWeight: 500 },
  successSub: { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  error: { color: "#ff6b6b", fontSize: 13, margin: "8px 0" },
  getApp: {
    padding: "10px 24px",
    border: "1px solid #333",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    borderRadius: 6,
    textDecoration: "none",
    margin: "8px 0",
  },
  footer: { marginTop: 40, fontSize: 11, color: "rgba(255,255,255,0.2)" },
};

const wallets = [new PhantomWalletAdapter()];

export function ClaimPageClient({ vibeId }: { vibeId: string }) {
  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ClaimInner vibeId={vibeId} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
