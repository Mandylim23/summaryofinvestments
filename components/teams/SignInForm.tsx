"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const origin = window.location.origin;
    const redirect = new URL("/auth/confirm", origin);
    const next = params.get("next");
    redirect.searchParams.set("next", next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: redirect.toString() },
    });
    if (authError) setError(authError.message); else setSent(true);
    setBusy(false);
  }
  return <form onSubmit={submit}>
    {params.get("error") === "confirmation" && <p role="alert">That sign-in link has expired or has already been used. Enter your email below to request a fresh link.</p>}
    <label style={{display:"grid",gap:8}}>Work email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <button type="submit" disabled={busy || sent} style={{marginTop:16}}>{busy ? "Sending…" : sent ? "Link sent" : "Email me a sign-in link"}</button>
    {sent && <p role="status">Check your inbox for a secure sign-in link.</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
