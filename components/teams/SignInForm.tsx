"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up" | "forgot";

export function SignInForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function safeNext() {
    const next = params.get("next");
    return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();
    if (mode === "forgot") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const redirectTo = new URL("/auth/update-password", appUrl).toString();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (authError) setError(authError.message);
      else setMessage("If an account exists for that email, we’ve sent password reset instructions.");
    } else if (mode === "sign-up") {
      const { error: authError } = await supabase.auth.signUp({ email: normalizedEmail, password });
      if (authError) setError(authError.message);
      else setMessage("Account created. Check your email if confirmation is required, then sign in.");
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError) setError(authError.message);
      else window.location.assign(safeNext());
    }
    setBusy(false);
  }

  function changeMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  const title = mode === "sign-up" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in to your investment team";

  return <section>
    <h1>{title}</h1>
    <p>{mode === "forgot" ? "We’ll send password reset instructions to your work email." : "Use your work email and password to continue."}</p>
    {params.get("error") === "confirmation" && <p role="alert">That old sign-in link expired. Sign in here with your password instead.</p>}
    <form onSubmit={submit} style={{display:"grid",gap:16}}>
      <label style={{display:"grid",gap:8}}>Work email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
      {mode !== "forgot" && <label style={{display:"grid",gap:8}}>Password<input type="password" required minLength={8} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} /></label>}
      <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset instructions" : "Sign in"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    <nav aria-label="Account options" style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:16}}>
      {mode !== "sign-in" && <button type="button" onClick={()=>changeMode("sign-in")}>Back to sign in</button>}
      {mode === "sign-in" && <><button type="button" onClick={()=>changeMode("forgot")}>Forgot password?</button><button type="button" onClick={()=>changeMode("sign-up")}>Create account</button></>}
    </nav>
  </section>;
}
