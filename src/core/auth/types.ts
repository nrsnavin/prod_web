export interface SessionUser {
  id: string;
  username: string;
  role: string;
  /** Shop-floor department that drives web nav/route access. */
  department?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Auth boundary (ISP): consumers see only what they need — the login page
// uses login(), the shell uses logout(), guards read the session.
export interface AuthService {
  login(credentials: LoginCredentials): Promise<SessionUser>;
  logout(): Promise<void>;
  fetchCurrentUser(): Promise<SessionUser>;
  // Self-service password reset (unauthenticated). forgotPassword always
  // resolves with a generic message regardless of whether the email exists.
  forgotPassword(email: string): Promise<{ message: string }>;
  resetPassword(token: string, password: string): Promise<{ message: string }>;
}
