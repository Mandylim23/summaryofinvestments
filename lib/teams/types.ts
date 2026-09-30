export type TeamRole = "owner" | "admin" | "member" | "viewer";

export interface Team {
  id: string;
  name: string;
  slug: string;
  is_demo: boolean;
  created_at: string;
}

export interface TeamMembership {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  team: Team;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: Exclude<TeamRole, "owner">;
  expires_at: string;
  accepted_at: string | null;
}
