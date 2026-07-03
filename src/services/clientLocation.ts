import { apiCall } from "./http";

export interface ClientVisitPayload {
  date: string;               // YYYY-MM-DD
  latitude: number;
  longitude: number;
  address?: string;
  notes?: string;
  capturedAt?: string;        // ISO instant
}

export interface ClientVisit {
  id: string;
  userId: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    employeeCode?: string;
  } | null;
  date: string;
  latitude: number;
  longitude: number;
  address: string;
  notes: string;
  capturedAt: string | null;   // check-in instant
  checkOut: string | null;     // set once the visit is closed
  hoursWorked?: number;
}

// Employee logs that they're working from a client location today.
export const submitClientLocation = (
  token: string,
  payload: ClientVisitPayload
): Promise<{ message: string; id: string }> =>
  apiCall("/attendance/client-location", {
    method: "POST",
    body: payload,
    token,
  });

// The caller's own recent client-location visits.
export const listMyClientLocations = (
  token: string,
  limit = 30
): Promise<ClientVisit[]> =>
  apiCall(`/attendance/client-location/mine?limit=${limit}`, { token });

// Close today's open client-location visit (stamps check-out + hours).
export const checkoutClientLocation = (
  token: string,
  payload: { checkOut?: string; notes?: string } = {}
): Promise<ClientVisit> =>
  apiCall("/attendance/client-location/checkout", {
    method: "POST",
    body: payload,
    token,
  });

// Manager (their reports) / HR (everyone) view of client-location visits.
export const listTeamClientLocations = (
  token: string,
  opts: { userId?: string; date?: string; month?: string } = {}
): Promise<ClientVisit[]> => {
  const params = new URLSearchParams();
  if (opts.userId) params.set("userId", opts.userId);
  if (opts.date) params.set("date", opts.date);
  if (opts.month) params.set("month", opts.month);
  const qs = params.toString();
  return apiCall(`/manager/client-locations${qs ? `?${qs}` : ""}`, { token });
};
