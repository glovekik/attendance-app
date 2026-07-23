import { apiCall } from "./http";

/**
 * Employee ID card (badge) issuance.
 *
 * The card is only ever rendered while status === "APPROVED". Submitting a
 * photo — including re-submitting over an already-approved card — puts it
 * back into "PENDING" and hides the card until HR approves again.
 */
export type IDCardStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

/** How the photo is positioned inside the card's fixed 3:4 frame. */
export interface IDCardFraming {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_FRAMING: IDCardFraming = { zoom: 1, offsetX: 0, offsetY: 0 };

export interface IDCardState {
  status: IDCardStatus;
  photoUrl?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  framing?: IDCardFraming | null;
  // Present on the HR-facing endpoints only.
  userId?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    employeeCode?: string;
    profilePictureUrl?: string;
  } | null;
}

// ===== employee =====

export const getMyIdCard = (token: string) =>
  apiCall<IDCardState>("/id-card/me", { token });

export const submitIdCardPhoto = (token: string, photoUrl: string) =>
  apiCall<IDCardState>("/id-card/photo", {
    method: "POST",
    body: { photoUrl },
    token,
  });

/**
 * Reposition / zoom the photo. Note: re-framing an already-APPROVED card sends
 * it back to PENDING (HR approves the framing that actually prints).
 */
export const setMyIdCardFraming = (token: string, framing: IDCardFraming) =>
  apiCall<IDCardState>("/id-card/framing", {
    method: "POST",
    body: framing,
    token,
  });

// ===== HR =====

export const hrListIdCards = (token: string, status?: IDCardStatus) =>
  apiCall<IDCardState[]>(
    `/hr/id-cards${status ? `?status=${status}` : ""}`,
    { token }
  );

export const hrGetIdCard = (token: string, userId: string) =>
  apiCall<IDCardState>(`/hr/id-cards/${userId}`, { token });

export const hrApproveIdCard = (token: string, userId: string) =>
  apiCall<IDCardState>(`/hr/id-cards/${userId}/approve`, {
    method: "POST",
    token,
  });

export const hrRejectIdCard = (
  token: string,
  userId: string,
  reason?: string
) =>
  apiCall<IDCardState>(`/hr/id-cards/${userId}/reject`, {
    method: "POST",
    body: { reason },
    token,
  });

/** HR fixes a badly-framed photo during review. Does not change status. */
export const hrSetIdCardFraming = (
  token: string,
  userId: string,
  framing: IDCardFraming
) =>
  apiCall<IDCardState>(`/hr/id-cards/${userId}/framing`, {
    method: "POST",
    body: framing,
    token,
  });
