"use client";

import { useState } from "react";
import { createTeamAction } from "@/app/teams/actions";

export function CreateTeamForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const result = await createTeamAction(new FormData(event.currentTarget));
    if (result.error) { setError(result.error); setBusy(false); return; }
    window.location.assign(`/?team=${encodeURIComponent(result.id!)}`);
  }
  return <form onSubmit={submit} style={{display:"grid",gap:12}}>
    <label>Team name<input name="name" required maxLength={120} value={name} onChange={e=>{setName(e.target.value);if(!slug)setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""))}} /></label>
    <label>Workspace address<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e=>setSlug(e.target.value)} /></label>
    <button disabled={busy}>{busy ? "Creating…" : "Create team"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
