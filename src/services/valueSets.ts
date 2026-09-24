import { apiCall } from "./http";

/**
 * Controlled vocabularies, fetched from the API rather than declared here.
 *
 * The server validates against these on save, so a second copy in the app
 * is how an option gets offered on a screen and then refused on submit.
 * /meta/value-sets is the single source of truth.
 */
export type ValueSetName =
  | "bloodGroup"
  | "gender"
  | "maritalStatus"
  | "relationship";

export type ValueSets = Record<ValueSetName, string[]>;

/**
 * Used if the request fails, so a dropdown never renders empty and trap
 * someone mid-edit. Kept minimal and identical to the server's list; the
 * server still has the final say on save.
 */
export const FALLBACK_VALUE_SETS: ValueSets = {
  bloodGroup: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
  gender: ["Male", "Female", "Other", "Prefer not to say"],
  maritalStatus: ["Single", "Married", "Divorced", "Widowed"],
  relationship: ["Mother", "Father", "Spouse", "Sibling", "Child", "Friend", "Other"],
};

export const getValueSets = (token?: string): Promise<ValueSets> =>
  apiCall<ValueSets>("/meta/value-sets", { token });
