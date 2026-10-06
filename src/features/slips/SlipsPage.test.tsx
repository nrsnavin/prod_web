import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SlipsPage } from "./SlipsPage";
import { Slip } from "./types";

const uploadMutate = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const slips: Partial<Slip>[] = [
  {
    id: "a", confirmCode: "4821", source: "whatsapp", sentByName: "Floor Lead", status: "ready",
    dateKey: "2026-10-06", shift: "DAY", createdAt: "2026-10-06T10:00:00Z",
    counts: { rows: 3, ready: 2, check: 1, skip: 0, applied: 0, unmatched: 0 },
  },
  {
    id: "b", confirmCode: "1234", source: "web", sentByName: "Owner", status: "failed",
    dateKey: null, shift: null, createdAt: "2026-10-06T11:00:00Z",
    counts: { rows: 0, ready: 0, check: 0, skip: 0, applied: 0, unmatched: 0 },
  },
];
vi.mock("./hooks", () => ({
  useSlips: () => ({ data: { slips, total: 2, page: 1, pageSize: 20 }, isLoading: false, isError: false }),
  useSlipMutations: () => ({ upload: { mutate: uploadMutate, isPending: false } }),
}));

describe("the slip list", () => {
  it("shows each slip's shift, sender, looms and status", () => {
    render(<MemoryRouter><SlipsPage /></MemoryRouter>);
    expect(screen.getAllByText("#4821").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Day shift · 6 Oct 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 ready · 1 to check").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs attention").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Shift not known yet").length).toBeGreaterThan(0);
  });

  it("uploads the chosen photos with the date and shift given", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SlipsPage /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /Upload photo/ }));
    const read = screen.getByRole("button", { name: "Read slip" });
    expect(read).toBeDisabled();

    const file = new File(["jpeg"], "slip.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/Photos of the slip/), file);
    await user.type(screen.getByLabelText("Date"), "2026-10-06");
    await user.selectOptions(screen.getByLabelText("Shift"), "NIGHT");
    await user.click(read);

    expect(uploadMutate).toHaveBeenCalledTimes(1);
    expect(uploadMutate.mock.calls[0][0]).toEqual({ files: [file], dateKey: "2026-10-06", shift: "NIGHT" });
  });
});
