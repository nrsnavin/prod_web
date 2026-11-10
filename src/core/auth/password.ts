// What a NEW password must be, as far as the browser can say. The server
// has the whole rule (utils/passwordPolicy.js in the API: not one of the
// passwords everybody tries, not the person's own name or email) and
// answers with its own words; this is the length check, so the common
// slip is caught before the form is sent.

export const MIN_PASSWORD_LENGTH = 8;

export const passwordTooShort = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

/** Why this cannot be a new password, or null when it can be sent. */
export function passwordProblem(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH ? passwordTooShort : null;
}
