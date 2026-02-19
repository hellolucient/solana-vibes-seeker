import Link from "next/link";

export const metadata = {
  title: "solana_vibes",
  description: "Send and claim vibes on Solana. Use the Android app or claim via link.",
};

export default function HomePage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <Link href="/" style={styles.titleLink}>
          <h1 style={styles.title}>solana_vibes</h1>
        </Link>
        <p style={styles.subtitle}>
          Send and claim vibes — unique NFTs on Solana. Use the Android app on
          your Seeker phone, or claim via link when someone sends you a vibe.
        </p>
        <Link href="/check" style={styles.primaryLink}>
          check for vibe
        </Link>
        <Link href="/leaderboard" style={styles.link}>
          Leaderboard →
        </Link>
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
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.5,
    marginBottom: 24,
  },
  primaryLink: {
    display: "inline-block",
    padding: "12px 20px",
    border: "1px solid rgba(148,90,255,0.4)",
    borderRadius: 8,
    color: "#14F195",
    fontSize: 14,
    textDecoration: "none",
    marginBottom: 12,
  },
  link: {
    display: "inline-block",
    padding: "12px 20px",
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    textDecoration: "none",
  },
};
