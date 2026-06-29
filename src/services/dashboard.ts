import { apiCall } from "./http";
import { DashboardHR, DashboardManager, DashboardMe } from "../types";

export const getDashboardMe = (token: string): Promise<DashboardMe> =>
  apiCall("/dashboard/me", { token });

export const getDashboardHr = (token: string): Promise<DashboardHR> =>
  apiCall("/dashboard/hr", { token });

export const getDashboardManager = (
  token: string
): Promise<DashboardManager> =>
  apiCall("/dashboard/manager", { token });

export interface UpcomingHoliday {
  name: string;
  date: string;
  daysUntil: number;
}

export interface UpcomingBirthday {
  id: string;
  name: string;
  birthday: string;
  daysUntil: number;
  profilePictureUrl?: string | null;
}

export interface UpcomingAnniversary {
  id: string;
  name: string;
  joiningDate: string;
  years: number;
  daysUntil: number;
  profilePictureUrl?: string | null;
}

export interface NewJoiner {
  id: string;
  name: string;
  joiningDate: string;
  daysAgo: number;
  profilePictureUrl?: string | null;
}

export interface UpcomingEvents {
  holidays: UpcomingHoliday[];
  birthdays: UpcomingBirthday[];
  anniversaries?: UpcomingAnniversary[];
  newJoiners?: NewJoiner[];
}

export const getUpcomingEvents = (
  token: string
): Promise<UpcomingEvents> =>
  apiCall("/dashboard/upcoming", { token });
