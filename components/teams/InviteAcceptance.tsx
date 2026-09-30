"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { acceptInviteAction } from "@/app/teams/actions";

export function InviteAcceptance({ token }: { token: string }) {
  const [status, setStatus] = useState("Confirming your secure sign-in…");
  const [error, setError] = useState("");
  const attempted = useRef(false);
  useEffect(() => {
    if (!token) { setError("This invitation link is missing its token."); return; }
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: "implicit", detectSessionInUrl: true } },
    );
    let active = true;
    const finish = async () => {
      if (attempted.current) return;
      attempted.current = true;
      setStatus("Adding you to the team…");
      const result = await acceptInviteAction(token);
      if (!active) return;
      if (result.error) { setError(result.error); return; }
      setStatus("Invitation accepted. Your team is ready.");
      window.location.assign(`/?team=${encodeURIComponent(result.teamId!)}`);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) void finish();
    });
    void supabase.auth.getSession().then(({ data }) => { if (data.session) void finish(); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [token]);
  return error ? <p role="alert">{error}</p> : <p role="status">{status}</p>;
}
