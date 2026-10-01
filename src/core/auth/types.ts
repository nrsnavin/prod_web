export interface SessionUser {
  id: string;
  username: string;
  role: string;
  /** Shop-floor department that drives web nav/route access. */
  department?: string | null;
  /** Per-user feature keys (nav paths) the user may open. When present,
   *  this — not department — decides what the nav/guards allow. */
  features?: string[];
  /** The employee record this login belongs to, when it is a workforce member. */
  employeeId?: string | null;
  /**
   * A worker's login: the app shows the employee view (their own shift,
   * loom, performance and pay) instead of the manager's. The server's
   * rule (utils/features.js isSelfServiceOnly), never re-derived here.
   */
  selfService?: boolean;
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
  // Email-OTP login (the primary sign-in). requestOtp emails a 6-digit
  // code (generic response, no enumeration); verifyOtp exchanges the code
  // for a session, same as login().
  requestOtp(email: string): Promise<{ message: string }>;
  verifyOtp(email: string, otp: string): Promise<SessionUser>;
}
