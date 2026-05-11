import { apiCall } from "./http";
import { AuditLog } from "../types";

export interface AuditFilters {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export const listAuditLogs = (
  token: string,
  filters: AuditFilters = {}
): Promise<AuditLog[]> => {
  const params = new URLSearchParams();
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.entityId) params.set("entityId", filters.entityId);
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  params.set("limit", String(filters.limit ?? 100));
  return apiCall(`/hr/audit-logs?${params.toString()}`, { token });
};
