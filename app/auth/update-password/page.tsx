"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else {
      setMessage("Password updated. You can now sign in.");
      setPassword("");
    }
    setBusy(false);
  }

  return <main style={{maxWidth:480,margin:"12vh auto",padding:24,fontFamily:"system-ui"}}>
    <h1>Set a new password</h1>
    <p>Choose a password with at least 8 characters.</p>
    <form onSubmit={submit} style={{display:"grid",gap:16}}>
      <label style={{display:"grid",gap:8}}>New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} /></label>
      <button type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
    </form>
    {message && <p role="status">{message} <a href="/auth/sign-in">Sign in</a></p>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
