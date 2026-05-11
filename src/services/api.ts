import { API_URL } from "../config";


// ================= SIGNUP =================
export const signupUser =
  async (data: any) => {

    const response = await fetch(

      `${API_URL}/auth/signup`,

      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          data
        ),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.detail ||
        "Signup failed"
      );
    }

    return result;
  };


// ================= LOGIN =================
export const loginUser =
  async (data: any) => {

    const response = await fetch(

      `${API_URL}/auth/login`,

      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          data
        ),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.detail ||
        "Login failed"
      );
    }

    return result;
  };

// ================= OTP VERIFY =================
export const verifyOtp = async (
  email: string,
  otp: string
): Promise<{ access_token: string; token_type: string }> => {
  const response = await fetch(`${API_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail || "OTP verification failed");
  }
  return result;
};

export const resendOtp = async (
  email: string
): Promise<{ message: string }> => {
  const response = await fetch(`${API_URL}/auth/resend-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp: "" }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail || "Resend failed");
  }
  return result;
  };


// ================= FORGOT PASSWORD =================
export const requestPasswordReset =
  async (email: string) => {

    const response = await fetch(
      `${API_URL}/auth/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.detail || "Could not request reset"
      );
    }

    return result;
  };


// ================= RESET PASSWORD =================
export const resetPassword =
  async (token: string, newPassword: string) => {

    const response = await fetch(
      `${API_URL}/auth/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.detail || "Reset failed"
      );
    }

    return result;
  };


// ================= GET ME =================
export const getMe =
  async (token: string) => {

    try {

      const response =
        await fetch(

          `${API_URL}/auth/me`,

          {
            method: "GET",

            headers: {

              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result.detail ||
          "Failed to fetch user"
        );
      }

      return result;

    } catch (error) {

      console.log(
        "GetMe error:",
        error
      );

      throw error;
    }
  };


// Robust JSON parse — handles empty bodies, HTML error pages, and
// network blips without surfacing raw "JSON parse error" to the UI.
const safeParse = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // Body wasn't JSON (HTML stack trace, plain text, etc.). Log a
    // truncated copy for debugging and return an empty object so the
    // caller can decide based on response.ok.
    console.log(
      "[api] non-JSON response:",
      response.status,
      text.slice(0, 200)
    );
    return { _raw: text.slice(0, 200) };
  }
};

const friendlyHttpError = (
  status: number,
  result: any,
  fallback: string
): Error => {
  if (result?.detail) return new Error(result.detail);
  if (status === 401) return new Error("Session expired — please log in again.");
  if (status === 403) return new Error("Not allowed to do that.");
  if (status === 404) return new Error("Endpoint not found.");
  if (status === 409) {
    const err: any = new Error(result?._raw || fallback);
    err.status = 409;
    return err;
  }
  if (status >= 500) {
    return new Error(
      "Server error — try again in a moment."
    );
  }
  return new Error(fallback);
};

// ================= CHECK IN =================
export const checkIn =
  async (
    token: string,
    data: any
  ) => {

    const response =
      await fetch(

        `${API_URL}/attendance/checkin`,

        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify(
            data
          ),
        }
      );

    const result = await safeParse(response);

    if (!response.ok) {
      throw friendlyHttpError(
        response.status,
        result,
        "Check in failed"
      );
    }

    return result;
  };


// ================= CHECK OUT =================
export const checkOut =
  async (
    token: string,
    data: any
  ) => {

    const response =
      await fetch(

        `${API_URL}/attendance/checkout`,

        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify(
            data
          ),
        }
      );

    const result = await safeParse(response);

    if (!response.ok) {
      throw friendlyHttpError(
        response.status,
        result,
        "Check out failed"
      );
    }

    return result;
  };


// ================= TODAY =================
export const getToday =
  async (token: string, date?: string) => {

    const qs = date
      ? `?date=${date}`
      : "";

    const response =
      await fetch(

        `${API_URL}/attendance/today${qs}`,

        {
          method: "GET",

          headers: {

            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.detail ||
        "Failed to fetch today"
      );
    }

    return result;
  };


// ================= HISTORY =================
export const getHistory =
  async (
    token: string,
    opts?: { before?: string; limit?: number }
  ) => {

    const parts: string[] = [];
    if (opts?.before) parts.push(`before=${opts.before}`);
    if (opts?.limit) parts.push(`limit=${opts.limit}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";

    const response =
      await fetch(

        `${API_URL}/attendance/history${qs}`,

        {
          method: "GET",

          headers: {

            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.detail ||
        "Failed to fetch history"
      );
    }

    return result;
  };


// ================= DELETE =================
export const deleteAttendance =
  async (
    token: string,
    id: string
  ) => {

    const response =
      await fetch(

        `${API_URL}/attendance/delete/${id}`,

        {
          method: "DELETE",

          headers: {

            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.detail ||
        "Delete failed"
      );
    }

    return result;
  };


// ================= UPDATE =================
export const updateAttendance =
  async (
    token: string,
    id: string,
    data: any
  ) => {

    const response =
      await fetch(

        `${API_URL}/attendance/update/${id}`,

        {
          method: "PUT",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify(
            data
          ),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.detail ||
        "Update failed"
      );
    }

    return result;
  };


// ================= MANUAL ENTRY =================
export const addManualEntry =
  async (
    token: string,
    data: {
      date: string;
      attendanceType: string;
      checkIn?: string | null;
      checkOut?: string | null;
      workNotes?: string;
    }
  ) => {

    const body: any = {
      date: data.date,
      attendanceType: data.attendanceType,
    };

    if (data.checkIn) body.checkIn = data.checkIn;
    if (data.checkOut) body.checkOut = data.checkOut;
    if (data.workNotes) body.workNotes = data.workNotes;

    const res = await fetch(
      `${API_URL}/attendance/manual`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      throw new Error(
        result?.detail || "Failed to save manual entry"
      );
    }

    return result;
  };