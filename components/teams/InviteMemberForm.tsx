"use client";

import { useState } from "react";
import { createInviteAction } from "@/app/teams/actions";
import type { TeamInvite, TeamRole } from "@/lib/teams/types";

export function InviteMemberForm({ teamId }: { teamId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<TeamRole, "owner">>("member");
  const [invite, setInvite] = useState<TeamInvite | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setInvite(null);
    const result = await createInviteAction({teamId,email:email.trim().toLowerCase(),role});
    if (result.error) setError(result.error); else { setInvite(result.invite!); setEmail(""); }
    setBusy(false);
  }
  return <form onSubmit={submit} style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"end"}}>
    <label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <label>Role<select value={role} onChange={e=>setRole(e.target.value as Exclude<TeamRole,"owner">)}>
      <option value="member">Member</option><option value="viewer">Viewer</option><option value="admin">Admin</option>
    </select></label>
    <button disabled={busy}>{busy?"Sending…":"Invite by email"}</button>
    {invite && <p role="status">Sign-in invitation sent to {invite.email}. It expires {new Date(invite.expires_at).toLocaleDateString()}.</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
