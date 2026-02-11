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

function formatTimestamp(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return "";
  }
}

interface VibeDetails {
  id: string;
  targetUsername: string;
  senderWallet: string;
  maskedWallet: string;
  vibeNumber: number;
  imageUri?: string;
  createdAt?: string;
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
  const [xToken, setXToken] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<ClaimState>("loading");
  const [error, setError] = useState<string | null>(null);

  const deepLink = `solanavibes://claim/${vibeId}`;
  const githubUrl = "https://github.com/hellolucient/solana-vibes-seeker";

  // Check for x= token in URL (iOS Safari fallback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("x");
    if (t) {
      setXToken(t);
      setXUser({ username: "..." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch vibe details and X user (from cookie)
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

        if (!xToken && meRes.ok) {
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
  }, [vibeId, xToken]);

  const handleConnectX = useCallback(() => {
    const returnTo = `/v/${vibeId}`;
    window.location.href = `${API_BASE}/api/auth/x?return_to=${encodeURIComponent(returnTo)}`;
  }, [vibeId]);

  const hasXAuth = xUser !== null || xToken !== null;

  const handleClaim = useCallback(async () => {
    if (!publicKey || !vibeDetails || !hasXAuth) {
      setError("Connect X and wallet first");
      return;
    }

    setClaimState("preparing");
    setError(null);

    const prepareBody: Record<string, string> = {
      vibeId: vibeDetails.id,
      claimerWallet: publicKey.toBase58(),
    };
    if (xToken) prepareBody.x = xToken;
    if (xUser && !xToken) prepareBody.xUsername = xUser.username;

    try {
      const prepareRes = await fetch(`${API_BASE}/api/vibe/claim/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(prepareBody),
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
  }, [publicKey, vibeDetails, hasXAuth, xUser, xToken, signTransaction]);

  const imageUrl = vibeDetails?.imageUri;

  if (claimState === "loading" || claimState === "error") {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>solana_vibes</h1>
        <div style={styles.centerContent}>
          {error && <p style={styles.errorText}>{error}</p>}
          <p style={styles.loadingText}>Loading vibe...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.scrollContent}>
        <h1 style={styles.title}>solana_vibes</h1>

        {/* Vibe image */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Vibe"
            style={styles.nftImage}
          />
        )}

        {/* Terminal-style info */}
        <div style={styles.terminalInfo}>
          <p style={styles.terminalLine}>
            &gt; <span style={styles.terminalGreen}>received solana_vibes</span>
          </p>
          <p style={styles.terminalLine}>
            &gt; <span style={styles.terminalGreen}>
              verified by wallet {vibeDetails?.maskedWallet}
            </span>
          </p>
          {vibeDetails?.mintAddress && (
            <p style={styles.terminalLine}>
              &gt; <span style={styles.terminalGreen}>
                mint {vibeDetails.mintAddress.slice(0, 4)}...
                {vibeDetails.mintAddress.slice(-4)}
              </span>
            </p>
          )}
          {vibeDetails?.createdAt && (
            <p style={styles.terminalLine}>
              {formatTimestamp(vibeDetails.createdAt)}
            </p>
          )}
          <p style={styles.terminalLine}>
            &gt; <span style={styles.terminalGreen}>
              for @{vibeDetails?.targetUsername}
            </span>
          </p>
        </div>

        {/* Claimed state */}
        {claimState === "success" ? (
          <div style={styles.claimedSection}>
            <div style={styles.claimedBadge}>
              <p style={styles.claimedBadgeTitle}>✓ Claimed</p>
              <p style={styles.claimedBadgeSub}>
                by {publicKey
                  ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
                  : "you"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p style={styles.vibeForText}>
              This vibe is for{" "}
              <span style={styles.vibeForUsername}>
                @{vibeDetails?.targetUsername}
              </span>
            </p>

            {/* Open in app */}
            <a href={deepLink} style={styles.openInApp}>
              → open in app
            </a>
            <p style={styles.divider}>or claim in browser</p>

            {!hasXAuth ? (
              <button onClick={handleConnectX} style={styles.btnClaim}>
                connect X
              </button>
            ) : !publicKey ? (
              <button onClick={() => setVisible(true)} style={styles.btnClaim}>
                connect wallet
              </button>
            ) : (
              <button
                onClick={handleClaim}
                disabled={
                  claimState === "preparing" ||
                  claimState === "signing" ||
                  claimState === "confirming"
                }
                style={styles.btnClaim}
              >
                {claimState === "preparing"
                  ? "Preparing..."
                  : claimState === "signing"
                  ? "Sign in wallet..."
                  : claimState === "confirming"
                  ? "Confirming..."
                  : "claim vibe"}
              </button>
            )}

            <p style={styles.feeText}>Claim fee: ~0.001 SOL</p>
            {error && <p style={styles.errorText}>{error}</p>}
          </>
        )}

        <p style={styles.divider}>don&apos;t have the app?</p>
        <a href={`${githubUrl}/releases`} style={styles.getApp}>
          get solana_vibes for android
        </a>
        <p style={styles.footer}>built for solana mobile</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'JetBrains Mono', 'Menlo', monospace",
    background: "#050505",
    color: "#fff",
    minHeight: "100vh",
    padding: 16,
  },
  scrollContent: {
    maxWidth: 400,
    margin: "0 auto",
    paddingBottom: 40,
  },
  centerContent: {
    textAlign: "center",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 300,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingTop: 12,
    paddingBottom: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  nftImage: {
    width: "100%",
    height: 250,
    borderRadius: 8,
    backgroundColor: "#0a0a0a",
    marginBottom: 20,
    objectFit: "cover",
  },
  terminalInfo: {
    width: "100%",
    marginBottom: 20,
  },
  terminalLine: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 24,
    margin: 0,
  },
  terminalGreen: {
    color: "#14F195",
  },
  vibeForText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 20,
  },
  vibeForUsername: {
    color: "#14F195",
    fontWeight: 600,
  },
  openInApp: {
    display: "block",
    textAlign: "center",
    padding: "10px 20px",
    marginBottom: 8,
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textDecoration: "none",
  },
  divider: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    margin: "16px 0",
    textAlign: "center",
  },
  btnClaim: {
    width: "100%",
    padding: "18px 24px",
    borderRadius: 12,
    border: "1px solid rgba(159,106,255,0.4)",
    background: "linear-gradient(180deg, rgba(159,106,255,0.12) 0%, rgba(20,241,149,0.06) 100%)",
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 16,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(159,106,255,0.15)",
  },
  feeText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.25)",
    marginTop: 12,
    textAlign: "center",
  },
  claimedSection: {
    width: "100%",
    marginTop: 8,
  },
  claimedBadge: {
    width: "100%",
    backgroundColor: "rgba(20,241,149,0.08)",
    border: "1px solid rgba(20,241,149,0.25)",
    borderRadius: 12,
    padding: "16px 20px",
    textAlign: "center",
  },
  claimedBadgeTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#14F195",
    margin: 0,
  },
  claimedBadgeSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
    margin: 0,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
  },
  getApp: {
    display: "block",
    textAlign: "center",
    padding: "10px 24px",
    border: "1px solid #333",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    borderRadius: 6,
    textDecoration: "none",
    margin: "8px auto",
    maxWidth: 200,
  },
  footer: {
    marginTop: 40,
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
  },
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
