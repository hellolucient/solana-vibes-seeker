import { LeaderboardClient } from "./LeaderboardClient";

export const metadata = {
  title: "leaderboard — solana_vibes",
  description: "Vibers this week, claimed vibes, and most vibed usernames.",
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
