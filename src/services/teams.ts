import { apiCall } from "./http";
import { Team } from "../types";

export interface CreateTeamPayload {
  name: string;
  teamLeadId: string;
  memberIds: string[];
}

export interface UpdateTeamPayload {
  name?: string;
  teamLeadId?: string;
  memberIds?: string[];
}

// HR endpoints
export const createTeam = (
  token: string,
  data: CreateTeamPayload
) =>
  apiCall<{ id: string; message: string }>("/hr/teams", {
    method: "POST",
    body: data,
    token,
  });

export const listTeams = (token: string) =>
  apiCall<Team[]>("/hr/teams", { token });

export const getTeam = (token: string, id: string) =>
  apiCall<Team>(`/hr/teams/${id}`, { token });

export const updateTeam = (
  token: string,
  id: string,
  data: UpdateTeamPayload
) =>
  apiCall<{ message: string }>(`/hr/teams/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const deleteTeam = (token: string, id: string) =>
  apiCall<{ message: string }>(`/hr/teams/${id}`, {
    method: "DELETE",
    token,
  });

// TL endpoints
export const listMyLedTeams = (token: string) =>
  apiCall<Team[]>("/tl/teams/mine", { token });
