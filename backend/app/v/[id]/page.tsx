import { ClaimPageClient } from "./ClaimPageClient";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClaimPageClient vibeId={id} />;
}
