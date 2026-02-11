"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
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

/** Mobile Safari (iOS) often fails to connect wallet; Phantom browse works. In Phantom/Solflare in-app browser, modal works. */
function usePhantomBrowse(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const inWalletBrowser = /Phantom|Solflare/i.test(ua);
  return isMobile && !inWalletBrowser;
}

function ClaimInner({ vibeId }: { vibeId: string }) {
  const { publicKey, connected, connecting, signTransaction, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const usePhantomBrowseFlow = usePhantomBrowse();

  const [vibeDetails, setVibeDetails] = useState<VibeDetails | null>(null);
  const [xUser, setXUser] = useState<{ username: string } | null>(null);
  const [xToken, setXToken] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<ClaimState>("loading");
  const [error, setError] = useState<string | null>(null);

  const deepLink = `solanavibes://claim/${vibeId}`;
  const githubUrl = "https://github.com/hellolucient/solana-vibes-seeker";
  const claimPageUrl =
    typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : "";
  const phantomBrowseUrl = claimPageUrl
    ? `https://phantom.app/ul/browse/${encodeURIComponent(claimPageUrl)}?ref=${encodeURIComponent(claimPageUrl)}`
    : "";

  const shortenedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

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

  const hasXAuth = xUser !== null || xToken !== null;
  const hasWallet = connected && publicKey;

  const handleConnectX = useCallback(() => {
    if (hasXAuth) {
      const msg = xUser?.username && xUser.username !== "..."
        ? `Disconnect @${xUser.username}?`
        : "Disconnect X?";
      if (!window.confirm(msg)) return;
      const returnTo = `/v/${vibeId}`;
      window.location.href = `${API_BASE}/api/auth/x/logout?return_to=${encodeURIComponent(returnTo)}`;
      return;
    }
    const returnTo = `/v/${vibeId}`;
    window.location.href = `${API_BASE}/api/auth/x?return_to=${encodeURIComponent(returnTo)}`;
  }, [vibeId, hasXAuth, xUser]);

  const handleConnectWallet = useCallback(() => {
    if (connecting) return;
    if (hasWallet) {
      if (!window.confirm("Disconnect wallet? You will need to reconnect to claim.")) return;
      disconnect();
      return;
    }
    if (usePhantomBrowseFlow && phantomBrowseUrl) {
      window.location.href = phantomBrowseUrl;
      return;
    }
    setVisible(true);
  }, [connecting, hasWallet, disconnect, usePhantomBrowseFlow, phantomBrowseUrl, setVisible]);

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

        {/* Terminal-style info — single block, tight spacing */}
        <div style={styles.terminalBlock}>
          <div style={styles.terminalLine}>
            &gt; <span style={styles.terminalGreen}>received solana_vibes</span>
          </div>
          <div style={styles.terminalLine}>
            &gt; <span style={styles.terminalGreen}>
              verified by wallet {vibeDetails?.maskedWallet}
            </span>
          </div>
          {vibeDetails?.mintAddress && (
            <div style={styles.terminalLine}>
              &gt; <span style={styles.terminalGreen}>
                mint {vibeDetails.mintAddress.slice(0, 4)}...
                {vibeDetails.mintAddress.slice(-4)}
              </span>
            </div>
          )}
          {vibeDetails?.createdAt && (
            <div style={styles.terminalLine}>{formatTimestamp(vibeDetails.createdAt)}</div>
          )}
          <div style={styles.terminalLine}>
            &gt; <span style={styles.terminalGreen}>
              for @{vibeDetails?.targetUsername}
            </span>
          </div>
        </div>

        {/* Claimed state */}
        {claimState === "success" ? (
          <div style={styles.claimedSection}>
            <div style={styles.claimedBadge}>
              <p style={styles.claimedBadgeTitle}>✓ Claimed</p>
              <p style={styles.claimedBadgeSub}>
                by {shortenedAddress || "you"}
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

            {/* Connect Wallet — on mobile Safari opens in Phantom; else shows modal. Tap when connected → disconnect confirm. */}
            <button
              type="button"
              onClick={handleConnectWallet}
              disabled={connecting}
              style={hasWallet ? { ...styles.connectBtn, ...styles.connectBtnDone } : styles.connectBtn}
            >
              {connecting ? (
                <>
                  <span style={styles.spinner} />
                  <span style={styles.connectBtnLabel}>Connecting...</span>
                </>
              ) : hasWallet ? (
                <>
                  <span style={styles.walletDot} />
                  <span style={styles.connectBtnLabelDone}>{shortenedAddress}</span>
                  <span style={styles.disconnectWallet}>Disconnect</span>
                </>
              ) : (
                <>
                  <span style={styles.phantomIcon}>◉</span>
                  <span style={styles.connectBtnLabel}>Connect wallet</span>
                </>
              )}
            </button>

            {/* Connect X — same look as MainScreen */}
            <button
              type="button"
              onClick={handleConnectX}
              style={hasXAuth ? { ...styles.connectXBtn, ...styles.connectXBtnDone } : styles.connectXBtn}
            >
              <span style={hasXAuth ? { ...styles.xIcon, ...styles.xIconDone } : styles.xIcon}>𝕏</span>
              {hasXAuth ? (
                <>
                  <span style={styles.connectXLabelDone}>
                    {xUser?.username && xUser.username !== "..."
                      ? `@${xUser.username}`
                      : "Connected"}
                  </span>
                  <span style={styles.disconnectX}>Disconnect</span>
                </>
              ) : (
                <span style={styles.connectXLabel}>Connect X</span>
              )}
            </button>

            {/* Claim button */}
            <button
              onClick={handleClaim}
              disabled={
                !hasWallet ||
                !hasXAuth ||
                claimState === "preparing" ||
                claimState === "signing" ||
                claimState === "confirming"
              }
              style={
                claimState === "preparing" ||
                claimState === "signing" ||
                claimState === "confirming"
                  ? { ...styles.btnClaim, ...styles.btnClaimProcessing }
                  : styles.btnClaim
              }
            >
              {claimState === "preparing"
                ? "Preparing..."
                : claimState === "signing"
                ? "Sign in wallet..."
                : claimState === "confirming"
                ? "Confirming..."
                : "claim vibe"}
            </button>

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
    padding: 16,
    display: "block",
    boxSizing: "border-box",
  },
  scrollContent: {
    maxWidth: 400,
    width: "100%",
    margin: "0 auto",
    paddingBottom: 32,
    paddingLeft: 0,
    paddingRight: 0,
    display: "block",
    boxSizing: "border-box",
  },
  centerContent: {
    textAlign: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 300,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingTop: 8,
    paddingBottom: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  nftImage: {
    width: "100%",
    height: 220,
    minHeight: 140,
    borderRadius: 8,
    backgroundColor: "#0a0a0a",
    marginBottom: 12,
    objectFit: "cover",
  },
  terminalBlock: {
    width: "100%",
    marginBottom: 16,
    padding: 0,
    display: "block",
  },
  terminalLine: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 1.4,
    margin: 0,
    padding: 0,
    display: "block",
    minHeight: "unset",
  },
  terminalGreen: {
    color: "#14F195",
  },
  vibeForText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 8,
  },
  vibeForUsername: {
    color: "#14F195",
    fontWeight: 600,
  },
  openInApp: {
    display: "block",
    textAlign: "center",
    padding: "8px 16px",
    marginBottom: 4,
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textDecoration: "none",
  },
  divider: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    margin: "8px 0",
    textAlign: "center",
  },
  // Connect wallet — match MainScreen connectBtn
  connectBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 10,
    border: "1px solid rgba(148,90,255,0.4)",
    background: "rgba(148,90,255,0.08)",
    marginBottom: 8,
    width: "100%",
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  connectBtnDone: {
    borderColor: "rgba(20,241,149,0.3)",
    background: "rgba(20,241,149,0.06)",
  },
  connectBtnLabel: {
    fontWeight: 500,
  },
  connectBtnLabelDone: {
    fontWeight: 500,
    flex: 1,
  },
  disconnectWallet: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    marginLeft: "auto",
  },
  phantomIcon: {
    fontSize: 16,
    color: "#9F6AFF",
  },
  walletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: "#9F6AFF",
    flexShrink: 0,
  },
  spinner: {
    display: "inline-block",
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "claim-spin 0.8s linear infinite",
  },
  // Connect X — match MainScreen connectXBtn
  connectXBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    marginBottom: 10,
    width: "100%",
    color: "rgba(255,255,255,0.5)",
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  connectXBtnDone: {
    borderColor: "rgba(20,241,149,0.3)",
    background: "rgba(20,241,149,0.06)",
    color: "#fff",
  },
  xIcon: {
    fontSize: 15,
  },
  xIconDone: {
    color: "#fff",
  },
  connectXLabel: {
    fontWeight: 500,
  },
  connectXLabelDone: {
    fontWeight: 500,
    flex: 1,
  },
  disconnectX: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    marginLeft: "auto",
  },
  btnClaim: {
    width: "100%",
    paddingTop: 18,
    paddingBottom: 18,
    borderRadius: 12,
    border: "1px solid rgba(159,106,255,0.4)",
    background: "linear-gradient(180deg, rgba(159,106,255,0.12) 0%, rgba(20,241,149,0.06) 100%)",
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 16,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(159,106,255,0.15)",
    marginTop: 4,
  },
  btnClaimProcessing: {
    opacity: 0.7,
  },
  feeText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.25)",
    marginTop: 8,
    textAlign: "center",
  },
  claimedSection: {
    width: "100%",
    maxWidth: "100%",
    marginTop: 8,
    boxSizing: "border-box",
  },
  claimedBadge: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    backgroundColor: "rgba(20,241,149,0.08)",
    border: "1px solid rgba(20,241,149,0.25)",
    borderRadius: 12,
    padding: "16px 20px",
    textAlign: "center",
    overflow: "hidden",
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

// Add keyframes for spinner
const spinnerStyle = `
@keyframes claim-spin {
  to { transform: rotate(360deg); }
}
`;

const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

export function ClaimPageClient({ vibeId }: { vibeId: string }) {
  return (
    <>
      <style>{spinnerStyle}</style>
      <ConnectionProvider endpoint={RPC}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <ClaimInner vibeId={vibeId} />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  );
}
