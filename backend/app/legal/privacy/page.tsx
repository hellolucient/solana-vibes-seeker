import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — solana_vibes",
  description: "Privacy policy for Solana Vibes Seeker. Data collection and protection.",
};

export default function PrivacyPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <Link href="/" style={styles.backLink}>
          ← solana_vibes
        </Link>
        <h1 style={styles.title}>Privacy Policy</h1>
        <p style={styles.subtitle}>
          URL to document explaining data collection and protection.
        </p>
        <div style={styles.body}>
          <p>
            This Privacy Policy describes how <strong>Solana Vibes Seeker</strong> (“we,” “our,” or “the App”) collects, uses, and protects information when you use our mobile app and related services.
          </p>

          <h2 style={styles.h2}>1. Information We Collect</h2>
          <ul style={styles.ul}>
            <li>
              <strong>Wallet addresses:</strong> When you connect a wallet (e.g., via Mobile Wallet Adapter), we use your public wallet address to prepare and confirm transactions (sending or claiming vibes). Wallet addresses are public on the Solana blockchain and may be stored in our systems to associate vibes with senders and recipients.
            </li>
            <li>
              <strong>X (Twitter) identity:</strong> To claim a vibe sent to your X username, you sign in with X (OAuth). We receive and store your X user ID and username only as needed to verify ownership and complete claims. We do not access your X timeline, DMs, or other private data.
            </li>
            <li>
              <strong>Vibe and usage data:</strong> We store records of vibes (sender, recipient username, mint address, status, timestamps) in our database to operate the service. NFT images and metadata may be stored on decentralized storage (e.g., Arweave).
            </li>
            <li>
              <strong>Technical data:</strong> Our API and web claim pages may use cookies or similar identifiers for session and OAuth flows (e.g., X login). We may log request metadata (e.g., IP, user agent) for security and operations.
            </li>
          </ul>

          <h2 style={styles.h2}>2. How We Use Information</h2>
          <p>
            We use the information above to: operate the vibe send/claim flow; verify X identity for claims; display leaderboards and your vibe history; improve and secure the service; and comply with law.
          </p>

          <h2 style={styles.h2}>3. Data Storage and Third Parties</h2>
          <p>
            Vibe records are stored in our database (Supabase). NFT assets may be stored on decentralized networks. Wallet interactions use your wallet provider (e.g., Phantom, Solflare). X sign-in is handled via X’s OAuth; we do not store your X password. We do not sell your personal data to third parties.
          </p>

          <h2 style={styles.h2}>4. Your Choices</h2>
          <p>
            You can disconnect your wallet and sign out of X from the App or web flow. Blockchain data (e.g., past transactions) remains public. You may contact us to ask about data we hold about you.
          </p>

          <h2 style={styles.h2}>5. Changes</h2>
          <p>
            We may update this policy from time to time. The “Last updated” date below will be revised when we do. Continued use of the App after changes constitutes acceptance of the updated policy.
          </p>

          <h2 style={styles.h2}>6. Contact</h2>
          <p>
            For questions about this Privacy Policy or our practices, please open an issue or contact the project via the Solana Vibes Seeker repository or official channels.
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
  h2: {
    fontSize: 16,
    fontWeight: 500,
    marginTop: 24,
    marginBottom: 8,
    color: "rgba(255,255,255,0.9)",
  },
  ul: {
    paddingLeft: 20,
    margin: "8px 0",
  },
  updated: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 24,
  },
};
