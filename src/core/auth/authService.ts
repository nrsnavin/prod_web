import { HttpClient, httpClient } from "@/core/http/httpClient";
import { AuthService, LoginCredentials, SessionUser } from "./types";

interface LoginResponse {
  username: string;
  id: string;
  role: string;
  department?: string | null;
  token: string;
}

interface GetUserResponse {
  success: boolean;
  user: { _id: string; name: string; role: string; department?: string | null };
}

class ApiAuthService implements AuthService {
  constructor(private readonly client: HttpClient) {}

  async login(credentials: LoginCredentials): Promise<SessionUser> {
    // Backend sets the httpOnly `token` cookie on this response; the
    // browser stores it automatically (withCredentials).
    const res = await this.client.post<LoginResponse>(
      "/user/login-user",
      credentials
    );
    return { id: res.id, username: res.username, role: res.role, department: res.department ?? null };
  }

  async logout(): Promise<void> {
    // No logout endpoint on the backend — the cookie is httpOnly so we
    // can't delete it client-side; clearing local session state is enough
    // (the cookie expires in 24h and guards ignore it without a session).
    return Promise.resolve();
  }

  async fetchCurrentUser(): Promise<SessionUser> {
    const res = await this.client.get<GetUserResponse>("/user/getuser");
    return {
      id: res.user._id,
      username: res.user.name,
      role: res.user.role,
      department: res.user.department ?? null,
    };
  }
}

export const authService: AuthService = new ApiAuthService(httpClient);
