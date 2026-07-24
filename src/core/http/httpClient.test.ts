import { describe, it, expect } from "vitest";
import { AxiosError } from "axios";
import { ApiError, toApiError } from "./httpClient";

// Build an AxiosError shaped like a real failed response so we exercise
// the same branch the response interceptor hits in the browser.
function axiosErrorWith(status: number, data: unknown): AxiosError {
  const err = new AxiosError("Request failed with status code " + status);
  err.response = {
    status,
    data,
    statusText: "",
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: {} as any,
  };
  return err;
}

describe("toApiError", () => {
  it("surfaces INSUFFICIENT_STOCK code and shortfall so the UI can force-approve", () => {
    const shortfall = {
      materialId: "abc123",
      materialName: "Nylon 40D",
      available: 12,
      required: 30,
      short: 18,
    };
    const err = toApiError(
      axiosErrorWith(400, {
        success: false,
        message: "Insufficient stock for Nylon 40D (have 12, need 30)",
        code: "INSUFFICIENT_STOCK",
        shortfall,
      })
    );

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("INSUFFICIENT_STOCK");
    expect(err.message).toContain("Insufficient stock for Nylon 40D");
    expect(err.data?.shortfall).toEqual(shortfall);
  });

  it("leaves code undefined for a plain error body", () => {
    const err = toApiError(
      axiosErrorWith(404, { success: false, message: "Order not found" })
    );
    expect(err.code).toBeUndefined();
    expect(err.message).toBe("Order not found");
  });

  it("maps a timeout to a friendly message", () => {
    const err = new AxiosError("timeout of 20000ms exceeded");
    err.code = "ECONNABORTED";
    const mapped = toApiError(err);
    expect(mapped.message).toMatch(/timed out/i);
  });
});
