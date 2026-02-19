"use client";

import React, { useCallback, useEffect, useState } from "react";

const API_BASE = "";

type View = "week" | "claimed";

interface WeekEntry {
  wallet: string;
  displayWallet: string;
  count: number;
  claimedCount: number;
}

interface ClaimedEntry {
  wallet: string;
  displayWallet: string;
  count: number;
}

type ApiResponse =
  | { view: "week"; entries: WeekEntry[] }
  | { view: "claimed"; entries: ClaimedEntry[] };

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'JetBrains Mono', 'Menlo', monospace",
    background: "#050505",
    color: "#fff",
    padding: 16,
    minHeight: "100vh",
    boxSizing: "border-box",
  },
  scrollContent: {
    maxWidth: 400,
    width: "100%",
    margin: "0 auto",
    paddingBottom: 32,
    boxSizing: "border-box",
  },
  title: {
    fontSize: 20,
    fontWeight: 300,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingTop: 8,
    paddingBottom: 16,
    marginTop: 4,
    marginBottom: 0,
  },
  toggleRow: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#0a0a0a",
    color: "rgba(255,255,255,0.7)",
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: 8,
  },
  toggleBtnActive: {
    borderColor: "rgba(20,241,149,0.35)",
    background: "rgba(20,241,149,0.06)",
    color: "#14F195",
  },
  listWrapper: {
    border: "1px solid rgba(148,90,255,0.4)",
    borderRadius: 10,
    padding: "4px 12px 12px",
    background: "rgba(148,90,255,0.04)",
    boxShadow: "0 0 24px rgba(148,90,255,0.22)",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  listItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid rgba(148,90,255,0.12)",
    gap: 12,
  },
  listItemWallet: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    wordBreak: "break-all",
  },
  listItemCount: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    flexShrink: 0,
  },
  listItemSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },
  loading: {
    textAlign: "center",
    padding: 24,
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  empty: {
    textAlign: "center",
    padding: 24,
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
  },
};

export function LeaderboardClient() {
  const [view, setView] = useState<View>("week");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async (v: View) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard?view=${v}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(view);
  }, [view, fetchLeaderboard]);

  return (
    <div style={styles.container}>
      <div style={styles.scrollContent}>
        <h1 style={styles.title}>solana_vibes</h1>

        <div style={styles.toggleRow}>
          <button
            type="button"
            onClick={() => setView("week")}
            style={
              view === "week"
                ? { ...styles.toggleBtn, ...styles.toggleBtnActive }
                : styles.toggleBtn
            }
          >
            Vibers — This Week
          </button>
          <button
            type="button"
            onClick={() => setView("claimed")}
            style={
              view === "claimed"
                ? { ...styles.toggleBtn, ...styles.toggleBtnActive }
                : styles.toggleBtn
            }
          >
            Claimed Vibes
          </button>
        </div>

        {loading ? (
          <p style={styles.loading}>Loading...</p>
        ) : view === "week" && data?.view === "week" ? (
          data.entries.length === 0 ? (
            <p style={styles.empty}>No vibes sent this week.</p>
          ) : (
            <div style={styles.listWrapper}>
              <ul style={styles.list}>
                {data.entries.map((entry, index) => (
                  <li
                    key={entry.wallet}
                    style={
                      index === data.entries.length - 1
                        ? { ...styles.listItem, borderBottom: "none" }
                        : styles.listItem
                    }
                  >
                  <div>
                    <div style={styles.listItemWallet}>
                      {entry.displayWallet}
                    </div>
                    {entry.claimedCount > 0 && (
                      <div style={styles.listItemSub}>
                        {entry.claimedCount} claimed
                      </div>
                    )}
                  </div>
                  <span style={styles.listItemCount}>
                    {entry.count} {entry.count === 1 ? "vibe" : "vibes"}
                  </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : view === "claimed" && data?.view === "claimed" ? (
          data.entries.length === 0 ? (
            <p style={styles.empty}>No claimed vibes yet.</p>
          ) : (
            <div style={styles.listWrapper}>
              <ul style={styles.list}>
                {data.entries.map((entry, index) => (
                  <li
                    key={entry.wallet}
                    style={
                      index === data.entries.length - 1
                        ? { ...styles.listItem, borderBottom: "none" }
                        : styles.listItem
                    }
                  >
                    <div style={styles.listItemWallet}>
                      {entry.displayWallet}
                    </div>
                    <span style={styles.listItemCount}>
                      {entry.count} {entry.count === 1 ? "claimed" : "claimed"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
