import { describe, it, expect, afterEach, vi } from "vitest";
import { AxiosError } from "axios";
import { ApiError, toApiError, throughLock, setLockOverrideAsker, DEFAULT_TIMEOUT_MS, MODEL_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from "./httpClient";

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

describe("how long a call waits", () => {
  it("a call handed to the model waits past the model's own two tries; an upload longer still", () => {
    // The server gives the model 30 s and tries twice (utils/aiGateway.js);
    // one photo read is given 90 s.
    expect(DEFAULT_TIMEOUT_MS).toBe(20_000);
    expect(MODEL_TIMEOUT_MS).toBeGreaterThan(2 * 30_000);
    expect(UPLOAD_TIMEOUT_MS).toBeGreaterThan(90_000);
    expect(UPLOAD_TIMEOUT_MS).toBeGreaterThan(MODEL_TIMEOUT_MS);
  });
});

describe("a write that meets the books lock", () => {
  afterEach(() => setLockOverrideAsker(undefined));
  const locked = () => new ApiError("The books are closed up to 31 Mar 2026", 409, undefined, "BOOKS_LOCKED", { details: { lockDate: "2026-03-31T00:00:00.000Z" } });

  it("is sent again with the reason an admin gives, once", async () => {
    const send = vi.fn().mockRejectedValueOnce(locked()).mockResolvedValueOnce({ ok: true });
    const asker = vi.fn().mockResolvedValue("Auditor asked for the March entry");
    setLockOverrideAsker(asker);
    await expect(throughLock({ amount: 100 }, send)).resolves.toEqual({ ok: true });
    expect(asker).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenNthCalledWith(1, { amount: 100 });
    expect(send).toHaveBeenNthCalledWith(2, { amount: 100, lockOverride: "Auditor asked for the March entry" });
  });

  it("goes back to the caller as refused when nobody may override, or they decide not to", async () => {
    const send = vi.fn().mockRejectedValue(locked());
    await expect(throughLock({ a: 1 }, send)).rejects.toMatchObject({ code: "BOOKS_LOCKED" });   // no asker
    setLockOverrideAsker(vi.fn().mockResolvedValue(null));
    await expect(throughLock({ a: 1 }, send)).rejects.toMatchObject({ code: "BOOKS_LOCKED" });   // asked, declined
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("asks nothing for any other refusal, and carries the reason on a form with files too", async () => {
    const asker = vi.fn().mockResolvedValue("Auditor asked for the March entry");
    setLockOverrideAsker(asker);
    const other = vi.fn().mockRejectedValue(new ApiError("No", 409, undefined, "PAYMENT_RISK"));
    await expect(throughLock({}, other)).rejects.toMatchObject({ code: "PAYMENT_RISK" });
    expect(asker).not.toHaveBeenCalled();

    const form = new FormData();
    form.append("fy", "2025-26");
    const sent: FormData[] = [];
    const send = vi.fn(async (b: unknown) => { sent.push(b as FormData); if (sent.length === 1) throw locked(); return "done"; });
    await expect(throughLock(form, send)).resolves.toBe("done");
    expect(sent[1].get("fy")).toBe("2025-26");
    expect(sent[1].get("lockOverride")).toBe("Auditor asked for the March entry");
    expect(form.get("lockOverride")).toBeNull();   // the form the caller holds is not changed
  });
});


// ════════════════════════════════════════════════════════════
//  A DOWNLOAD THE SERVER REFUSED
//
//  A PDF, a spreadsheet or a report is asked for as a file, so whatever
//  comes back arrives as a file — the refusal too. The reason was in
//  there ("You don't have access to this feature", "Try a shorter date
//  range", the reference to give the administrator) and nobody opened
//  it: every refused download read "Request failed with status code 403".
// ════════════════════════════════════════════════════════════
describe("a refused download", () => {
  const blobOf = (body: unknown, type = "application/json") => new Blob([typeof body === "string" ? body : JSON.stringify(body)], { type });

  it("says what the server said", async () => {
    const { withReadableBody } = await import("./httpClient");
    const refused = axiosErrorWith(403, blobOf({ success: false, message: "You don't have access to this feature" }));
    const err = toApiError(await withReadableBody(refused));
    expect(err.status).toBe(403);
    expect(err.message).toBe("You don't have access to this feature");
  });

  it("keeps the code and the reference", async () => {
    const { withReadableBody } = await import("./httpClient");
    const refused = axiosErrorWith(500, blobOf({ success: false, code: "SERVER_ERROR", ref: "4F2A91C0", message: "Something went wrong on the server, and it has been logged. Try again — if it keeps happening, give the administrator this reference: 4F2A91C0." }));
    const err = toApiError(await withReadableBody(refused));
    expect(err.code).toBe("SERVER_ERROR");
    expect(err.message).toContain("4F2A91C0");
    expect(err.data?.ref).toBe("4F2A91C0");
  });

  it("leaves a body that is not the server's JSON alone", async () => {
    const { withReadableBody } = await import("./httpClient");
    const page = axiosErrorWith(502, blobOf("<html><body>Bad Gateway</body></html>", "text/html"));
    const err = toApiError(await withReadableBody(page));
    expect(err.status).toBe(502);
    expect(err.message).toBe("Request failed with status code 502");
  });

  it("leaves an ordinary refusal as it was", async () => {
    const { withReadableBody } = await import("./httpClient");
    const plain = axiosErrorWith(400, { message: "Pick a report" });
    expect(toApiError(await withReadableBody(plain)).message).toBe("Pick a report");
    const notAxios = new Error("boom");
    expect(await withReadableBody(notAxios)).toBe(notAxios);
  });
});
