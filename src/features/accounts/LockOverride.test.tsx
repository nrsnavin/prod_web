import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, setLockOverrideAsker, throughLock } from "@/core/http/httpClient";
import { LockOverrideHost } from "./LockOverride";

// A write dated inside a closed period is refused by the server. An
// admin is asked why it should go through, once, in one place, and the
// write is sent again with the reason; anyone else is shown the refusal
// as it is. The reason used to be asked for by no screen at all: the
// server took one, and nothing in the app could send it.

let role = "admin";
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role } }) }));

const locked = () => new ApiError("The books are locked up to 30 Sep 2026", 423, undefined, "BOOKS_LOCKED", { details: { lockDate: "2026-09-30T00:00:00.000Z" } });

afterEach(() => { setLockOverrideAsker(undefined); role = "admin"; });

describe("the books lock, met by a write", () => {
  it("asks an admin why, and sends the write again with the reason", async () => {
    render(<LockOverrideHost />);
    const send = vi.fn().mockRejectedValueOnce(locked()).mockResolvedValueOnce({ success: true, voucherNo: "PAY/2026-27/0031" });
    let out: unknown;
    await act(async () => { void throughLock({ amount: 500, date: "2026-09-12" }, send).then((r) => { out = r; }); });

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("The books are closed up to 30 Sep 2026");
    // A reason too short to mean anything does not go.
    await userEvent.click(within(dialog).getByRole("button", { name: "Post it anyway" }));
    expect(send).toHaveBeenCalledTimes(1);
    await userEvent.type(within(dialog).getByRole("textbox"), "Bank charge found after the month closed");
    await userEvent.click(within(dialog).getByRole("button", { name: "Post it anyway" }));

    await vi.waitFor(() => expect(out).toEqual({ success: true, voucherNo: "PAY/2026-27/0031" }));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual({ amount: 500, date: "2026-09-12", lockOverride: "Bank charge found after the month closed" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves the write refused when the admin backs out", async () => {
    render(<LockOverrideHost />);
    const send = vi.fn().mockRejectedValue(locked());
    let failed: unknown;
    await act(async () => { void throughLock({ amount: 500 }, send).catch((e) => { failed = e; }); });
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(failed).toBeInstanceOf(ApiError));
    expect((failed as ApiError).code).toBe("BOOKS_LOCKED");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("asks one at a time when two writes are refused together", async () => {
    render(<LockOverrideHost />);
    const first = vi.fn().mockRejectedValueOnce(locked()).mockResolvedValueOnce("one");
    const second = vi.fn().mockRejectedValueOnce(locked()).mockResolvedValueOnce("two");
    const done: string[] = [];
    await act(async () => {
      void throughLock({ n: 1 }, first).then((r) => done.push(r as string));
      void throughLock({ n: 2 }, second).then((r) => done.push(r as string));
    });
    expect(await screen.findAllByRole("dialog")).toHaveLength(1);
    await userEvent.type(screen.getByRole("textbox"), "Corrected after the audit query");
    await userEvent.click(screen.getByRole("button", { name: "Post it anyway" }));
    await vi.waitFor(() => expect(done).toEqual(["one"]));
    // The second is asked for its own reason.
    const next = await screen.findByRole("dialog");
    expect(within(next).getByRole("textbox")).toHaveValue("");
    await userEvent.type(within(next).getByRole("textbox"), "Second entry of the same correction");
    await userEvent.click(within(next).getByRole("button", { name: "Post it anyway" }));
    await vi.waitFor(() => expect(done).toEqual(["one", "two"]));
    expect(second.mock.calls[1][0]).toEqual({ n: 2, lockOverride: "Second entry of the same correction" });
  });

  it("does not ask anyone who is not an admin: the refusal is shown as it is", async () => {
    role = "accounts";
    render(<LockOverrideHost />);
    const send = vi.fn().mockRejectedValue(locked());
    await expect(throughLock({ amount: 500 }, send)).rejects.toMatchObject({ code: "BOOKS_LOCKED" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays out of the way of every other refusal", async () => {
    render(<LockOverrideHost />);
    const send = vi.fn().mockRejectedValue(new ApiError("Amount must be more than 0", 400, undefined, "VALIDATION"));
    await expect(throughLock({ amount: 0 }, send)).rejects.toMatchObject({ message: "Amount must be more than 0" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
