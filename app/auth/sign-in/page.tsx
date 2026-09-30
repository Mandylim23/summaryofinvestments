import { Suspense } from "react";
import { SignInForm } from "@/components/teams/SignInForm";

export default function SignInPage() {
  return <main style={{maxWidth: 480, margin: "12vh auto", padding: 24, fontFamily: "system-ui"}}>
    <h1>Sign in to your investment team</h1>
    <p>We’ll email you a secure sign-in link.</p>
    <Suspense fallback={<p>Loading…</p>}><SignInForm /></Suspense>
  </main>;
}
