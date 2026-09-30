import { Suspense } from "react";
import { InviteAcceptance } from "@/components/teams/InviteAcceptance";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main style={{maxWidth: 560, margin: "12vh auto", padding: 24, fontFamily: "system-ui"}}>
    <h1>Join your investment team</h1>
    <Suspense fallback={<p>Confirming your sign-in…</p>}><InviteAcceptance token={token} /></Suspense>
  </main>;
}
