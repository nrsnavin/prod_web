import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TimerPhotos, photoSummary, type TimerPhotoMeta } from "./TimerPhotos";

// The verify screen shows the timer photos kept for the shift: the one
// the run time came from opens first, and each says what was read.

const get = vi.fn();
const getBlob = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: (...a: unknown[]) => get(...a), getBlob: (...a: unknown[]) => getBlob(...a) } };
});

const photo = (over: Partial<TimerPhotoMeta>): TimerPhotoMeta => ({
  id: "p1", takenAt: "2026-10-05T04:30:00Z", takenBy: "Ravi", size: 200_000,
  readText: "07:45:12", readKind: "run_time", readProblem: null, used: false, runTimeUsed: null, ...over,
});

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><TimerPhotos shiftId="sd-1" /></QueryClientProvider>);
}

beforeEach(() => {
  get.mockReset();
  getBlob.mockReset();
  getBlob.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});

describe("timer photos on the verify screen", () => {
  it("opens the photo the run time came from, full size, with who took it", async () => {
    get.mockResolvedValue({
      photos: [
        photo({ id: "p2", readText: null, readProblem: "glare" }),
        photo({ id: "p1", used: true, runTimeUsed: "7:45:12" }),
      ],
    });
    wrap();
    expect(await screen.findByText("Timer photos (2)")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/ocr/timer/shift/sd-1/photos");
    expect(await screen.findByRole("img", { name: "The loom's timer, full size" })).toBeInTheDocument();
    expect(screen.getByText("Run time 7:45:12 filled from this photo")).toBeInTheDocument();
    expect(screen.getByText(/Taken .* by Ravi/)).toBeInTheDocument();
    expect(getBlob).toHaveBeenCalledWith("/ocr/timer/photo/p1/file");
  });

  it("shows another photo when tapped, and closes", async () => {
    get.mockResolvedValue({ photos: [photo({ id: "p2", readText: null, readProblem: "glare" }), photo({ id: "p1", used: true, runTimeUsed: "7:45:12" })] });
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: /Glare on the display/ }));
    expect(screen.getByText("Glare on the display")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close the photo" }));
    expect(screen.queryByRole("img", { name: /full size/ })).not.toBeInTheDocument();
  });

  it("shows nothing when no photo was taken", async () => {
    get.mockResolvedValue({ photos: [] });
    const { container } = wrap();
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("says what each photo was", () => {
    expect(photoSummary(photo({}))).toBe("Read “07:45:12”, not used");
    expect(photoSummary(photo({ readText: null, readProblem: "not_set_up" }))).toBe("Not read: reading photos isn't set up");
    expect(photoSummary(photo({ readText: null }))).toBe("Not read");
  });
});
