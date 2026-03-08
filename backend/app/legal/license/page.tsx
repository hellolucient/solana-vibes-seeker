import Link from "next/link";

export const metadata = {
  title: "License — solana_vibes",
  description: "MIT License for Solana Vibes Seeker. Transparency and compliance.",
};

export default function LicensePage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <Link href="/" style={styles.backLink}>
          ← solana_vibes
        </Link>
        <h1 style={styles.title}>License</h1>
        <p style={styles.subtitle}>
          URL to document ensuring transparency and compliance.
        </p>
        <pre style={styles.license}>
{`MIT License

Copyright (c) 2025–2026 Solana Vibes Seeker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
        </pre>
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
  license: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
  },
};
