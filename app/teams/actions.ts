"use server";

import { createTeam, createTeamInvite, acceptTeamInvite } from "@/lib/teams/server";
import type { TeamInvite, TeamRole } from "@/lib/teams/types";

export async function createTeamAction(formData: FormData): Promise<{ id?: string; error?: string }> {
  try {
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    return { id: await createTeam(name, slug) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create team." };
  }
}

export async function createInviteAction(input: { teamId: string; email: string; role: Exclude<TeamRole, "owner"> }): Promise<{ invite?: TeamInvite; error?: string }> {
  try {
    return { invite: await createTeamInvite(input.teamId, input.email, input.role) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send invitation." };
  }
}

export async function acceptInviteAction(token: string): Promise<{ teamId?: string; error?: string }> {
  try {
    return { teamId: await acceptTeamInvite(token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not accept invitation." };
  }
}
