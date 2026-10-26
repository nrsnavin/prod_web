import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoveringBeamSheet } from "./CoveringBeamSheet";
import { BeamSheetRow, Covering } from "./types";

// The filled covering programme, photographed: the rows come back marked,
// a person checks and fixes them, saves, and prints the new beams' labels.

const readSheet = vi.fn();
const saveBeams = vi.fn();
vi.mock("./hooks", () => ({
  useCoveringMutations: () => ({
    readSheet: { mutate: readSheet, isPending: false },
    saveBeams: { mutate: saveBeams, isPending: false },
  }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const covering: Covering = {
  _id: "c1",
  status: "in_progress",
  job: { _id: "j1", jobOrderNo: 48, customer: { name: "Suguna" } },
  elasticPlanned: [],
  beamEntries: [{ _id: "b1", beamNo: 1, weight: 12.5 }],
  producedWeight: 12.5,
};
const row = (sNo: number, beamNo: number | null, weight: number | null, status: BeamSheetRow["status"], extra: Partial<BeamSheetRow> = {}): BeamSheetRow => ({
  sNo, beamNo, weight, remarks: "", printed: false, confidence: 0.9, status, recordedWeight: null, ...extra,
});
const read = (rows: BeamSheetRow[], warnings: string[] = []) =>
  readSheet.mockImplementation((_v, opts) => opts.onSuccess({
    success: true, available: true, warnings, suggestionId: "s1",
    reading: { jobOrderNo: 48, sheetRef: "CV-ED789E", totalWeight: null, problem: null, rows },
    covering: { _id: "c1", jobOrderNo: 48, sheetRef: "CV-ED789E", status: "in_progress" },
  }));

async function readPhoto() {
  render(<CoveringBeamSheet open onClose={() => {}} covering={covering} />);
  const file = new File([new Uint8Array([1, 2, 3])], "sheet.jpg", { type: "image/jpeg" });
  await userEvent.upload(screen.getByLabelText(/photo of the filled covering programme/i), file);
  await userEvent.click(screen.getByRole("button", { name: /read sheet/i }));
}
const rowOf = (sNo: number) => screen.getByRole("checkbox", { name: `Save row ${sNo}` }).closest("tr") as HTMLElement;

beforeEach(() => {
  readSheet.mockReset();
  saveBeams.mockReset();
  toast.mockReset();
});

describe("reading the covering beam sheet", () => {
  it("ticks the new beams and leaves the recorded ones, saves, and offers the new beams' labels", async () => {
    read([row(1, 1, 12.5, "recorded_same", { recordedWeight: 12.5 }), row(2, 2, 13.1, "new"), row(3, 3, 12.8, "new")]);
    await readPhoto();
    expect(readSheet).toHaveBeenCalledWith({ id: "c1", files: [expect.any(File)] }, expect.anything());

    expect(within(rowOf(1)).getByText("Already recorded")).toBeInTheDocument();
    expect(within(rowOf(1)).getByRole("checkbox")).toBeDisabled();
    expect(within(rowOf(2)).getByRole("checkbox")).toBeChecked();

    // A misread fixed by typing over it.
    const w3 = screen.getByLabelText("Weight on row 3");
    await userEvent.clear(w3);
    await userEvent.type(w3, "12.6");
    await userEvent.type(screen.getByLabelText("Remarks on row 2"), "joint");

    saveBeams.mockImplementation((_v, opts) => opts.onSuccess({
      success: true, skipped: [], producedWeight: 38.2, totalBeams: 3,
      added: [{ _id: "e2", beamNo: 2, weight: 13.1, note: "joint" }, { _id: "e3", beamNo: 3, weight: 12.6, note: "" }],
    }));
    await userEvent.click(screen.getByRole("button", { name: "Save 2 beams" }));
    expect(saveBeams).toHaveBeenCalledWith({
      id: "c1", suggestionId: "s1",
      beams: [{ beamNo: 2, weight: 13.1, note: "joint" }, { beamNo: 3, weight: 12.6, note: undefined }],
    }, expect.anything());
    expect(toast).toHaveBeenCalledWith("2 beams saved", "success");
    expect(screen.getByText(/Saved beams 2, 3 — 25.70 kg/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /print labels for these beams/i }))
      .toHaveAttribute("href", expect.stringMatching(/\/covering\/c1\/beam-labels\.pdf\?beams=2,3$/));
  });

  it("shows a weight that disagrees with the recorded one, and never saves it", async () => {
    read([row(1, 1, 15, "recorded_different", { recordedWeight: 12.5 })]);
    await readPhoto();
    expect(within(rowOf(1)).getByText("Recorded at 12.50 kg")).toBeInTheDocument();
    expect(within(rowOf(1)).getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save 0 beams" })).toBeDisabled();
  });

  it("a row with no weight waits until it is filled in", async () => {
    read([row(4, 4, null, "invalid")]);
    await readPhoto();
    expect(within(rowOf(4)).getByText("Weight?")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Weight on row 4"), "11.2");
    expect(within(rowOf(4)).getByText("New")).toBeInTheDocument();
    expect(within(rowOf(4)).getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: "Save 1 beam" })).toBeEnabled();
  });

  it("holds the save while one beam is on two ticked rows", async () => {
    read([row(1, 5, 12, "new"), row(2, 6, 12.4, "new")]);
    await readPhoto();
    const b2 = screen.getByLabelText("Beam # on row 2");
    await userEvent.clear(b2);
    await userEvent.type(b2, "5");
    expect(within(rowOf(2)).getByText("On another row too")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save 1 beam" })).toBeDisabled();
    await userEvent.click(within(rowOf(2)).getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Save 1 beam" })).toBeEnabled();
  });

  it("says when the sheet is for another job", async () => {
    read([row(1, 2, 12, "new")], ["This sheet says J-49; this covering is for J-48."]);
    await readPhoto();
    expect(screen.getByRole("alert")).toHaveTextContent("This sheet says J-49; this covering is for J-48.");
  });

  it("says so when reading photos is not set up", async () => {
    readSheet.mockImplementation((_v, opts) => opts.onSuccess({ success: true, available: false, message: "Reading photos is not set up." }));
    await readPhoto();
    expect(screen.getByRole("alert")).toHaveTextContent("Reading photos is not set up.");
  });
});
