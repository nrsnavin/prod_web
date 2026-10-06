import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/core/http/httpClient";
import { StockShortDialog, stockShortFrom } from "./StockShortDialog";

describe("stockShortFrom", () => {
  it("reads the shortfall off a DC_STOCK_SHORT refusal", () => {
    const e = new ApiError("Not enough in stock", 409, undefined, "DC_STOCK_SHORT", {
      details: {
        shortfalls: [{ name: "20mm Woven", shipping: 900, onHand: 600, short: 300 }],
        minReasonLength: 10,
      },
    });
    expect(stockShortFrom(e)).toEqual({
      shortfalls: [{ name: "20mm Woven", shipping: 900, onHand: 600, short: 300 }],
      minReasonLength: 10,
      message: "Not enough in stock",
    });
  });

  it("is null for any other error", () => {
    expect(stockShortFrom(new ApiError("Changed meanwhile", 409, undefined, "CHANGED_MEANWHILE"))).toBeNull();
    expect(stockShortFrom(new Error("boom"))).toBeNull();
  });

  it("falls back to 8 characters when the server sends no minimum", () => {
    const e = new ApiError("Not enough", 409, undefined, "DC_STOCK_SHORT", {});
    expect(stockShortFrom(e)).toMatchObject({ shortfalls: [], minReasonLength: 8 });
  });
});

describe("StockShortDialog", () => {
  const short = {
    shortfalls: [
      { name: "20mm Woven", shipping: 900, onHand: 600, short: 300 },
      { name: "32mm Knitted", shipping: 50, onHand: 0, short: 50 },
    ],
    minReasonLength: 8,
  };

  it("lists every short line", () => {
    render(<StockShortDialog open short={short} onClose={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText("20mm Woven")).toBeInTheDocument();
    expect(screen.getByText("Shipping 900 · In stock 600 · Short 300")).toBeInTheDocument();
    expect(screen.getByText("Shipping 50 · In stock 0 · Short 50")).toBeInTheDocument();
  });

  it("confirms only with a long enough reason, trimmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<StockShortDialog open short={short} onClose={() => {}} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /send anyway/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/reason for sending more/i), "  Packed this morning  ");
    await user.click(screen.getByRole("button", { name: /send anyway/i }));
    expect(onConfirm).toHaveBeenCalledWith("Packed this morning");
  });
});
