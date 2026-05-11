import { apiCall } from "./http";
import {
  Asset,
  AssetStatus,
  AssetReport,
  AssetReportType,
  AssetReportStatus,
} from "../types";

// ===== HR =====
export interface CreateAssetPayload {
  code: string;
  name: string;
  category: string;
  serialNumber?: string;
  notes?: string;
  purchaseDate?: string;
  purchasePrice?: number;
}

export interface UpdateAssetPayload {
  name?: string;
  category?: string;
  serialNumber?: string;
  notes?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  status?: AssetStatus;
}

export interface ListAssetsFilters {
  status?: AssetStatus;
  assignedToUserId?: string;
  category?: string;
  search?: string;
}

const buildQs = (f?: ListAssetsFilters) => {
  if (!f) return "";
  const parts: string[] = [];
  if (f.status) parts.push(`status=${f.status}`);
  if (f.assignedToUserId)
    parts.push(`assignedToUserId=${f.assignedToUserId}`);
  if (f.category)
    parts.push(`category=${encodeURIComponent(f.category)}`);
  if (f.search)
    parts.push(`search=${encodeURIComponent(f.search)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const hrCreateAsset = (
  token: string,
  data: CreateAssetPayload
) =>
  apiCall<Asset>("/hr/assets", {
    method: "POST",
    body: data,
    token,
  });

export const hrListAssets = (
  token: string,
  filters?: ListAssetsFilters
) =>
  apiCall<Asset[]>(`/hr/assets${buildQs(filters)}`, { token });

export const hrGetAsset = (token: string, id: string) =>
  apiCall<Asset>(`/hr/assets/${id}`, { token });

export const hrUpdateAsset = (
  token: string,
  id: string,
  data: UpdateAssetPayload
) =>
  apiCall<Asset>(`/hr/assets/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const hrDeleteAsset = (token: string, id: string) =>
  apiCall<{ message: string }>(`/hr/assets/${id}`, {
    method: "DELETE",
    token,
  });

export const hrAssignAsset = (
  token: string,
  id: string,
  data: { userId: string; notes?: string }
) =>
  apiCall<Asset>(`/hr/assets/${id}/assign`, {
    method: "POST",
    body: data,
    token,
  });

export const hrReturnAsset = (
  token: string,
  id: string,
  data: {
    notes?: string;
    status?: "AVAILABLE" | "DAMAGED" | "LOST";
  }
) =>
  apiCall<Asset>(`/hr/assets/${id}/return`, {
    method: "POST",
    body: data,
    token,
  });

// HR — Reports
export const hrListAssetReports = (
  token: string,
  status?: AssetReportStatus
) => {
  const qs = status ? `?status=${status}` : "";
  return apiCall<AssetReport[]>(`/hr/asset-reports${qs}`, {
    token,
  });
};

export const hrResolveAssetReport = (
  token: string,
  id: string,
  data: {
    action: "RESOLVE" | "REJECT";
    resolution?: string;
    newAssetStatus?: AssetStatus;
  }
) =>
  apiCall<{ message: string }>(
    `/hr/asset-reports/${id}/resolve`,
    { method: "POST", body: data, token }
  );

// ===== USER =====
export const listMyAssets = (token: string) =>
  apiCall<Asset[]>("/assets/mine", { token });

export const reportAssetIssue = (
  token: string,
  assetId: string,
  data: { reportType: AssetReportType; description: string }
) =>
  apiCall<AssetReport>(`/assets/${assetId}/report-issue`, {
    method: "POST",
    body: data,
    token,
  });
