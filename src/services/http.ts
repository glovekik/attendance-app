import { API_URL } from "../config";
import { refreshSession } from "./session";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Options {
  method?: Method;
  body?: any;
  token?: string;
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const apiCall = async <T = any>(
  path: string,
  opts: Options = {}
): Promise<T> => {

  const { method = "GET", body, token } = opts;

  const doFetch = (authToken?: string) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch(token);

  // Reactive refresh: a 401 on an authenticated request means the access
  // token expired mid-session. Silently swap it for a fresh one (single-
  // flight, so concurrent 401s share one refresh) and retry ONCE. If the
  // refresh token is also gone/dead, refreshSession() returns null and we
  // fall through to the normal !res.ok error — the next dashboard load will
  // then route the user to login.
  if (res.status === 401 && token) {
    const fresh = await refreshSession();
    if (fresh) {
      res = await doFetch(fresh);
    }
  }

  let data: any = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(
      data?.detail ||
      data?.message ||
      `Request failed (${res.status})`,
      res.status,
      data
    );
  }

  return data as T;
};
