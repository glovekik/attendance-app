import { API_URL } from "../config";

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

  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
