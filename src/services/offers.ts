import { apiCall } from "./http";
import { Offer, OfferStatus } from "../types";

export interface OfferPayload {
  candidateId: string;
  position: string;
  annualCtc?: number;
  joiningDate?: string;
  validUntil?: string;
  notes?: string;
  salaryBreakdown?: any;
}

export const listOffers = (
  token: string,
  opts: { candidateId?: string; status?: OfferStatus } = {}
): Promise<Offer[]> => {
  const params = new URLSearchParams();
  if (opts.candidateId) params.set("candidateId", opts.candidateId);
  if (opts.status) params.set("status", opts.status);
  const qs = params.toString();
  return apiCall(`/hr/offers${qs ? `?${qs}` : ""}`, { token });
};

export const createOffer = (
  token: string,
  payload: OfferPayload
): Promise<Offer> =>
  apiCall("/hr/offers", { method: "POST", body: payload, token });

export const updateOffer = (
  token: string,
  id: string,
  payload: Partial<OfferPayload>
): Promise<Offer> =>
  apiCall(`/hr/offers/${id}`, { method: "PUT", body: payload, token });

export const sendOffer = (
  token: string,
  id: string
): Promise<Offer> =>
  apiCall(`/hr/offers/${id}/send`, { method: "POST", token });

export const recordOfferDecision = (
  token: string,
  id: string,
  outcome: "ACCEPTED" | "REJECTED",
  note?: string
): Promise<Offer> =>
  apiCall(`/hr/offers/${id}/record-decision`, {
    method: "POST",
    body: { outcome, note },
    token,
  });

export const revokeOffer = (
  token: string,
  id: string
): Promise<Offer> =>
  apiCall(`/hr/offers/${id}/revoke`, { method: "POST", token });
