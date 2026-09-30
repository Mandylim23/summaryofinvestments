"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Team } from "@/lib/teams/types";

/** Tenant selector to embed in a signed-in app shell. */
export function TeamSwitcher({ value, onChange }: { value: string; onChange: (teamId: string) => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const load = async()=>{
      setLoading(true); setError("");
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){if(active){setTeams([]);setLoading(false)}return}
      const { data, error: queryError } = await supabase.from("team_members").select("team:teams(id,name,slug,is_demo,created_at)")
      .order("joined_at", { ascending: true });
        if (!active) return;
        if (queryError) setError(queryError.message);
        setTeams((data ?? []).flatMap((row) => row.team ? [row.team as unknown as Team] : []));
        setLoading(false);
    };
    void load();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")void load()});
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (loading) return <span aria-live="polite">Loading teams…</span>;
  return <><label className="team-switcher"><span className="sr-only">Active team</span><select value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="d0000000-0000-0000-0000-000000000001">SP Holdings · Demo</option>
    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
  </select></label>{error&&<span role="alert">Could not load teams: {error}</span>}</>;
}
