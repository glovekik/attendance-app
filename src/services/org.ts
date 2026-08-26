import { apiCall } from "./http";

export interface OrgPerson {
  id: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  employeeCode?: string | null;
  jobTitle?: string | null;
  role?: string | null;
  departmentId?: string | null;
  reportingManagerId?: string | null;
}

export interface OrgProject {
  id: string;
  name?: string | null;
  code?: string | null;
  status: string;
  departmentId?: string | null;
  managers: OrgPerson[];
  members: OrgPerson[];
  headcount: number;
}

export interface OrgDepartment {
  id: string;
  name?: string | null;
  description?: string | null;
  head: OrgPerson | null;
  headcount: number;
  projects: OrgProject[];
  /** In the department but not on any of its projects. */
  directMembers: OrgPerson[];
}

export interface OrgChart {
  ceo: OrgPerson | null;
  departments: OrgDepartment[];
  projectsWithoutDepartment: OrgProject[];
  unassigned: OrgPerson[];
  totals: {
    people: number;
    departments: number;
    projects: number;
    unassigned: number;
    hasCeo: boolean;
  };
}

/** Company org chart: CEO → department → project → employee. */
export const getOrgChart = (token: string): Promise<OrgChart> =>
  apiCall("/org/chart", { token });

export interface PersonProject {
  projectId: string;
  name?: string | null;
  code?: string | null;
  status: string;
  departmentName?: string | null;
  role: "manager" | "member";
  joinedAt: string;
  leftAt: string | null;
}

/** Projects this person is on now, and ones they've left. */
export const getPersonProjects = (
  token: string,
  userId: string
): Promise<{ current: PersonProject[]; past: PersonProject[] }> =>
  apiCall(`/org/people/${userId}/projects`, { token });
