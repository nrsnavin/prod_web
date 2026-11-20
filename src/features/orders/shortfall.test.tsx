import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApiError } from "@/core/http/httpClient";
import { ForceApprovalDialog } from "./ForceApprovalDialog";
import { shortfallsOf } from "./shortfall";

// ════════════════════════════════════════════════════════════
//  FORCING AN APPROVAL: EVERYTHING THAT IS SHORT
//
//  The server used to name the first short material and stop; forcing
//  then drew down every one. It now names them all, and the dialog the
//  admin types a reason into has to show them all — the decision is
//  theirs only if they can see what it covers.
// ════════════════════════════════════════════════════════════

const refusal = (data: Record<string, unknown>) => new ApiError(String(data.message ?? ""), 400, undefined, "INSUFFICIENT_STOCK", data);

const rubber = { materialId: "m1", materialName: "Rubber 40", available: 5, required: 30, short: 25 };
const nylon = { materialId: "m2", materialName: "Nylon 70D", available: 2.5, required: 12, short: 9.5 };

describe("shortfallsOf", () => {
  it("is every material the server named", () => {
    expect(shortfallsOf(refusal({ shortfall: rubber, details: { shortfalls: [rubber, nylon] } }))).toEqual([rubber, nylon]);
  });

  it("is the one material an older server names", () => {
    expect(shortfallsOf(refusal({ shortfall: rubber }))).toEqual([rubber]);
  });

  it("is nothing when the refusal carries no figures", () => {
    expect(shortfallsOf(refusal({ message: "Insufficient stock" }))).toEqual([]);
    expect(shortfallsOf(new Error("boom"))).toEqual([]);
  });
});

describe("the dialog, given several", () => {
  it("lists each short material with its own figures", () => {
    render(
      <ForceApprovalDialog open shortfall={rubber} shortfalls={[rubber, nylon]} originalMessage="Insufficient stock for 2 materials"
        onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText("Rubber 40")).toBeInTheDocument();
    expect(screen.getByText("Nylon 70D")).toBeInTheDocument();
    expect(screen.getByText(/Need 12 kg · Available 2\.50 kg · Short 9\.50 kg/)).toBeInTheDocument();
    // Each once: the first is not also drawn as the single card.
    expect(screen.getAllByText("Rubber 40")).toHaveLength(1);
  });
});
