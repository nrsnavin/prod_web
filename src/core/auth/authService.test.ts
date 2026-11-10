import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "./password";

// Signing out has to reach the server: the session cookie is httpOnly,
// so the page cannot delete it, and until this call existed "log out"
// left it good in the browser for the rest of its day.

const post = vi.fn();
vi.mock("@/core/http/httpClient", () => ({
  httpClient: { post: (...a: unknown[]) => post(...(a as [])), get: vi.fn() },
  ApiError: class extends Error {},
}));

beforeEach(() => { post.mockClear(); });

describe("signing out", () => {
  it("ends the session on the server", async () => {
    const { authService } = await import("./authService");
    post.mockResolvedValue({ success: true });
    await authService.logout();
    expect(post).toHaveBeenCalledWith("/user/logout", {});
  });

  it("still signs out here when the server cannot be reached", async () => {
    const { authService } = await import("./authService");
    post.mockRejectedValue(new Error("Network Error"));
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});

describe("a new password, as far as the browser can say", () => {
  it("needs eight characters; the server says the rest", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(passwordProblem("abc")).toMatch(/at least 8 characters/);
    expect(passwordProblem("1234567")).toMatch(/at least 8/);
    expect(passwordProblem("12345678")).toBeNull();
  });
});
