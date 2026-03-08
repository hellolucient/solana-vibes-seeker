import Link from "next/link";

export const metadata = {
  title: "Copyright — solana_vibes",
  description: "Copyright and ownership notice for Solana Vibes Seeker.",
};

export default function CopyrightPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <Link href="/" style={styles.backLink}>
          ← solana_vibes
        </Link>
        <h1 style={styles.title}>Copyright</h1>
        <p style={styles.subtitle}>
          URL to document confirming ownership and legal compliance.
        </p>
        <div style={styles.body}>
          <p>
            <strong>Solana Vibes Seeker</strong> (the “App”) and its associated
            software, design, and documentation are owned by the Solana Vibes
            Seeker project and its contributors.
          </p>
          <p>
            Copyright © 2025–2026 Solana Vibes Seeker. All rights reserved.
          </p>
          <p>
            The App is provided under the MIT License. You may use, copy,
            modify, and distribute the software in accordance with that license.
            See the{" "}
            <Link href="/legal/license" style={styles.inlineLink}>
              License
            </Link>{" "}
            page for full terms.
          </p>
          <p>
            “Solana Vibes,” “solana_vibes,” and related names and branding are
            used for this project. Solana is a trademark of the Solana
            Foundation. X (Twitter) and related marks are property of their
            respective owners.
          </p>
          <p style={styles.updated}>Last updated: March 2026.</p>
        </div>
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
    padding: 24,
    boxSizing: "border-box",
  },
  content: {
    maxWidth: 640,
    margin: "0 auto",
  },
  backLink: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    textDecoration: "none",
    marginBottom: 24,
    display: "inline-block",
  },
  title: {
    fontSize: 22,
    fontWeight: 300,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.9)",
    marginTop: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.5,
    marginBottom: 24,
  },
  body: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 1.7,
  },
  inlineLink: {
    color: "#14F195",
    textDecoration: "none",
  },
  updated: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 24,
  },
};
