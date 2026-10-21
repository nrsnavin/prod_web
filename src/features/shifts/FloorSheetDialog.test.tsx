import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloorSheetDialog, likelyShift } from "./FloorSheetDialog";

const downloadFloor = vi.fn().mockResolvedValue(undefined);
vi.mock("./sheet", () => ({ sheetService: { downloadFloor: (...a: unknown[]) => downloadFloor(...a) } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("the floor sheet", () => {
  it("downloads for the date and shift chosen, then closes", async () => {
    const onClose = vi.fn();
    render(<FloorSheetDialog onClose={onClose} />);
    const date = screen.getByLabelText("Date");
    await userEvent.clear(date);
    await userEvent.type(date, "2026-10-21");
    await userEvent.selectOptions(screen.getByLabelText("Shift"), "NIGHT");
    await userEvent.click(screen.getByRole("button", { name: /Download PDF/ }));
    expect(downloadFloor).toHaveBeenCalledWith("2026-10-21", "NIGHT");
    expect(onClose).toHaveBeenCalled();
  });

  it("guesses the shift someone printing now means", () => {
    expect(likelyShift(new Date(2026, 9, 21, 9))).toBe("DAY");
    expect(likelyShift(new Date(2026, 9, 21, 21))).toBe("NIGHT");
    expect(likelyShift(new Date(2026, 9, 21, 2))).toBe("NIGHT");
  });
});
