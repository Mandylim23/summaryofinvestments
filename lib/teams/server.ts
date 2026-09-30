import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import type { Team, TeamInvite, TeamRole } from "./types";

/** List only teams the signed-in user belongs to (enforced by RLS). */
export async function listMyTeams(): Promise<Team[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("team_members")
    .select("team:teams(id,name,slug,is_demo,created_at)").order("joined_at", { ascending: true });
  if (error) throw new Error(`Could not load teams: ${error.message}`);
  return (data ?? []).flatMap((row) => row.team ? [row.team as unknown as Team] : []);
}

/** Create a team and its first owner atomically. */
export async function createTeam(name: string, slug: string): Promise<string> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("create_team", {
    team_name: name.trim(), team_slug: slug.trim().toLowerCase(),
  });
  if (error) throw new Error(`Could not create team: ${error.message}`);
  return data as string;
}

/**
 * Store the invite, then email a Supabase Auth magic link whose redirect carries
 * the one-time raw invite token to /auth/accept-invite. That route calls
 * acceptTeamInvite after middleware establishes the authenticated session.
 * Supabase Auth SMTP and its template must allow/include the redirect URL.
 */
export async function createTeamInvite(teamId: string, email: string, role: Exclude<TeamRole, "owner"> = "member"): Promise<TeamInvite> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Enter a valid email address.");
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const supabase = await createServerClient();
  const { data: id, error } = await supabase.rpc("create_team_invite", {
    target_team_id: teamId, invite_email: normalizedEmail, invite_role: role, invite_token_hash: tokenHash,
  });
  if (error) throw new Error(`Could not create invite: ${error.message}`);
  const { data: invite, error: readError } = await supabase.from("team_invites")
    .select("id,team_id,email,role,expires_at,accepted_at").eq("id", id).single();
  if (readError || !invite) throw new Error(`Invite was stored but could not be read: ${readError?.message ?? "Unknown error"}`);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required to send team invitations.");
  const redirect = new URL("/auth/accept-invite", appUrl);
  redirect.searchParams.set("token", rawToken);
  const mailClient = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error: emailError } = await mailClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: true, emailRedirectTo: redirect.toString() },
  });
  if (emailError) throw new Error(`Invite stored but magic-link email failed: ${emailError.message}`);
  await mailClient.auth.signOut();
  return invite as TeamInvite;
}

export async function acceptTeamInvite(rawToken: string): Promise<string> {
  if (!rawToken || rawToken.length > 256) throw new Error("Invalid invitation token.");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("accept_team_invite", { invite_token_hash: tokenHash });
  if (error) throw new Error(`Could not accept invite: ${error.message}`);
  return data as string;
}
