import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GstinHint, SimilarParties } from "./PartyCardFill";
import { gstinInfo } from "./gstin";

// A GSTIN is checked as it is typed, and a firm already on file is named
// before a second record splits its ledger.

const get = vi.fn(async () => ({ success: true, similar: [{ _id: "c1", name: "SUNRISE GARMENTS PVT LTD", why: "similar name" }] }));
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...(a as [])) } }));
vi.mock("@/core/hooks/useDebouncedValue", () => ({ useDebouncedValue: <T,>(v: T) => v }));

describe("party forms", () => {
  it("reads the state and PAN off a GSTIN and catches a typo in its last character", () => {
    expect(gstinInfo("27AAPFU0939F1ZV")).toEqual({ valid: true, stateCode: "27", pan: "AAPFU0939F", checksumOk: true });
    expect(gstinInfo("27AAPFU0939F1ZX").checksumOk).toBe(false);
    const { rerender } = render(<GstinHint gstin="27AAPFU0939F1ZV" />);
    expect(screen.getByText("State 27 · PAN AAPFU0939F")).toBeInTheDocument();
    rerender(<GstinHint gstin="27AAPFU0939F1ZX" />);
    expect(screen.getByText(/does not match — check for a typo/)).toBeInTheDocument();
    rerender(<GstinHint gstin="27AAP" />);
    expect(screen.getByText(/Not a GSTIN/)).toBeInTheDocument();
  });

  it("names a firm already on file as the name is typed", async () => {
    render(<MemoryRouter><SimilarParties kind="customer" name="Sunrise Garments" gstin="" phone="" /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("SUNRISE GARMENTS PVT LTD (similar name)");
    expect(screen.getByRole("link", { name: "SUNRISE GARMENTS PVT LTD" })).toHaveAttribute("href", "/customers/c1");
    expect(get).toHaveBeenCalledWith("/customer/similar", expect.objectContaining({ name: "Sunrise Garments" }));
  });
});
