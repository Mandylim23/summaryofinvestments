import { Suspense } from "react";
import { SignInForm } from "@/components/teams/SignInForm";

export default function SignInPage() {
  return <main style={{maxWidth: 480, margin: "12vh auto", padding: 24, fontFamily: "system-ui"}}>
    <Suspense fallback={<p>Loading…</p>}><SignInForm /></Suspense>
  </main>;
}
