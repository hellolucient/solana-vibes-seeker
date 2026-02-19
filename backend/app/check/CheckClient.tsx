"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = "";

type State = "loading" | "connect" | "checking" | "has_vibe" | "no_vibe" | "already_claimed" | "error";

export function CheckClient() {
  const [state, setState] = useState<State>("loading");
  const [vibeUrl, setVibeUrl] = useState<string | null>(null);
  const [solscanUrl, setSolscanUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [xUsername, setXUsername] = useState<string | null>(null);

  const checkForVibe = useCallback(async () => {
    setState("checking");
    setErrorMessage(null);
    try {
      const meRes = await fetch(`${API_BASE}/api/auth/x/me`, { credentials: "include" });
      if (!meRes.ok) {
        setState("connect");
        return;
      }
      const me = await meRes.json();
      if (!me.connected || !me.username) {
        setState("connect");
        setXUsername(null);
        return;
      }
      setXUsername(me.username);
      const pendingRes = await fetch(
        `${API_BASE}/api/vibe/pending/by-username?username=${encodeURIComponent(me.username)}`,
        { credentials: "include" }
      );
      if (!pendingRes.ok) {
        setState("error");
        setErrorMessage("Could not check for vibe.");
        return;
      }
      const data = await pendingRes.json();
      if (data.hasClaimed) {
        setSolscanUrl(data.solscanUrl ?? null);
        setState("already_claimed");
        return;
      }
      if (data.hasPending && data.vibeId && data.vibeUrl) {
        // Double-check the vibe is still pending before redirecting (same DB, but avoid
        // sending user to claim page for an already-claimed vibe, e.g. if claimed on app meanwhile)
        const vibeRes = await fetch(`${API_BASE}/api/vibe/${data.vibeId}`, { credentials: "include" });
        if (vibeRes.ok) {
          const vibe = await vibeRes.json();
          if (vibe.claimStatus === "claimed") {
            setSolscanUrl(
              vibe.mintAddress
                ? `https://solscan.io/token/${vibe.mintAddress}`
                : null
            );
            setState("already_claimed");
            return;
          }
        }
        setVibeUrl(data.vibeUrl);
        setState("has_vibe");
        window.location.href = data.vibeUrl;
        return;
      }
      setState("no_vibe");
    } catch {
      setState("error");
      setErrorMessage("Something went wrong.");
    }
  }, []);

  useEffect(() => {
    checkForVibe();
  }, [checkForVibe]);

  // Handle OAuth error in URL (e.g. user denied)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    const msg = params.get("message");
    if (err === "x_oauth") {
      setState("connect");
      if (msg === "denied") setErrorMessage("You cancelled the sign-in.");
      else if (msg) setErrorMessage(msg);
      window.history.replaceState({}, "", "/check");
    }
  }, []);

  const returnToCheck =
    typeof window !== "undefined" ? `${window.location.origin}/check` : "/check";
  const connectXUrl = `${API_BASE}/api/auth/x?return_to=${encodeURIComponent(returnToCheck)}`;
  const logoutUrl = `${API_BASE}/api/auth/x/logout?return_to=${encodeURIComponent(returnToCheck)}`;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <Link href="/" style={styles.titleLink}>
          <h1 style={styles.title}>solana_vibes</h1>
        </Link>

        {(state === "loading" || state === "checking") && (
          <p style={styles.subtitle}>
            {state === "checking" ? "Checking for your vibe…" : "Loading…"}
          </p>
        )}

        {state === "connect" && (
          <>
            <p style={styles.subtitle}>
              Connect X to see if someone sent you a vibe.
            </p>
            {errorMessage && (
              <p style={styles.errorText}>{errorMessage}</p>
            )}
            <a href={connectXUrl} style={styles.primaryBtn}>
              Connect X
            </a>
          </>
        )}

        {state === "no_vibe" && (
          <>
            {xUsername && (
              <p style={styles.connectedAs}>
                connected as @{xUsername}{" "}
                <a href={logoutUrl} style={styles.disconnectLink}>
                  disconnect
                </a>
              </p>
            )}
            <p style={styles.noVibe}>no_vibe...yet!</p>
            <p style={styles.subtitle}>
              When someone sends you a vibe, it’ll show up here.
            </p>
          </>
        )}

        {state === "already_claimed" && (
          <>
            {xUsername && (
              <p style={styles.connectedAs}>
                connected as @{xUsername}{" "}
                <a href={logoutUrl} style={styles.disconnectLink}>
                  disconnect
                </a>
              </p>
            )}
            <p style={styles.noVibe}>your vibe has already been claimed</p>
            <p style={styles.subtitle}>
              You’ve already claimed this vibe. It’s in your wallet.
            </p>
            {solscanUrl && (
              <a
                href={solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.primaryBtn}
              >
                view on Solscan
              </a>
            )}
          </>
        )}

        {state === "has_vibe" && vibeUrl && (
          <p style={styles.subtitle}>
            Redirecting to your vibe…
          </p>
        )}

        {state === "error" && (
          <>
            {errorMessage && <p style={styles.errorText}>{errorMessage}</p>}
            <button
              type="button"
              onClick={() => checkForVibe()}
              style={styles.primaryBtn}
            >
              Try again
            </button>
          </>
        )}

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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
  },
  content: {
    maxWidth: 400,
    width: "100%",
    textAlign: "center",
  },
  titleLink: {
    textDecoration: "none",
    color: "inherit",
  },
  title: {
    fontSize: 22,
    fontWeight: 300,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.9)",
    marginTop: 0,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.5,
    marginBottom: 24,
  },
  connectedAs: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 16,
  },
  disconnectLink: {
    color: "rgba(255,255,255,0.5)",
    textDecoration: "none",
  },
  noVibe: {
    fontSize: 20,
    fontWeight: 300,
    letterSpacing: 1,
    color: "#14F195",
    marginBottom: 12,
  },
  primaryBtn: {
    display: "inline-block",
    padding: "14px 24px",
    border: "1px solid rgba(148,90,255,0.4)",
    borderRadius: 10,
    background: "rgba(148,90,255,0.08)",
    color: "#fff",
    fontSize: 15,
    textDecoration: "none",
    marginBottom: 16,
    cursor: "pointer",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    marginBottom: 16,
  },
};
