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
