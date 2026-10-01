import { httpClient } from "@/core/http/httpClient";

// A richer read of the current login than SessionUser carries — the
// session persisted at login time never had email or the linked Employee
// record on it (login-user/verify-otp don't return them), so the profile
// page reads this fresh from the server instead of the auth store.

export interface MeEmployee {
  name: string;
  department?: string | null;
  phoneNumber?: string;
  role?: string;
  hourlyRate?: number;
}

export interface MeProfile {
  id: string;
  name: string;
  /** Null for a worker login, which signs in by phone and PIN. */
  email: string | null;
  role: string;
  department?: string | null;
  features: string[];
  employee: MeEmployee | null;
  /** A worker's login: sees only their own work (the server's rule). */
  selfService?: boolean;
  createdAt?: string;
}

interface MeResponse {
  success: boolean;
  user: MeProfile;
}

export const profileService = {
  async getMe(): Promise<MeProfile> {
    const res = await httpClient.get<MeResponse>("/user/me");
    return res.user;
  },
};
