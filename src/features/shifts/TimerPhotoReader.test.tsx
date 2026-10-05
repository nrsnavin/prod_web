import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/core/http/httpClient";
import { TimerPhotoReader } from "./TimerPhotoReader";

// The photo is read, anything unclear is asked about with the photo
// beside it, and the field is filled only on "Use this".

const post = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { post: (...a: unknown[]) => post(...a) } };
});

beforeEach(() => {
  post.mockReset();
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});

const photo = new File(["x"], "timer.jpg", { type: "image/jpeg" });
const choose = (file = photo) => userEvent.upload(screen.getByTestId("timer-photo-input"), file);
const reply = (reading: object) => post.mockImplementation((url: string) =>
  url === "/ocr/timer" ? Promise.resolve({ reading, suggestionId: "s1" }) : Promise.resolve({ success: true }));

describe("reading the timer", () => {
  it("fills the field with a clear reading once the person says so", async () => {
    reply({ displays: [{ text: "07:45:12", kind: "run_time", label: "RUN", confidence: 0.95, alternatives: [] }], primary: 0, problem: null });
    const onUse = vi.fn();
    render(<TimerPhotoReader onUse={onUse} />);
    await choose();

    expect(post.mock.calls[0][0]).toBe("/ocr/timer");
    expect(post.mock.calls[0][1]).toBeInstanceOf(FormData);
    expect(await screen.findByText("7:45:12")).toBeInTheDocument();
    expect(screen.getByAltText("The timer photo")).toBeInTheDocument();
    expect(onUse).not.toHaveBeenCalled(); // nothing until confirmed

    await userEvent.click(screen.getByRole("button", { name: /use this/i }));
    expect(onUse).toHaveBeenCalledWith("7:45:12");
    expect(post).toHaveBeenCalledWith("/ocr/timer/s1/settle", { runTime: "7:45:12" });
    expect(screen.getByText(/filled from the photo/i)).toBeInTheDocument();
  });

  it("asks for the start reading of an hours meter, and works out the run time", async () => {
    reply({ displays: [{ text: "1234.6", kind: "hour_meter", label: "HRS", confidence: 0.9, alternatives: [] }], primary: 0, problem: null });
    const onUse = vi.fn();
    // Inside a form, as on the production entry screen: answering must
    // never submit the entry.
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={onSubmit}><TimerPhotoReader onUse={onUse} /></form>);
    await choose();

    expect(await screen.findByText(/total-hours meter reading 1234.6 h/)).toBeInTheDocument();
    const box = screen.getByLabelText(/meter reading at the start/i);
    await userEvent.type(box, "1240");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/lower than the reading now/);

    await userEvent.clear(screen.getByLabelText(/meter reading at the start/i));
    await userEvent.type(screen.getByLabelText(/meter reading at the start/i), "1226,85"); // a comma works too
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: /use this/i }));
    expect(onUse).toHaveBeenCalledWith("7:45:00");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("answers with Enter without submitting the entry", async () => {
    reply({ displays: [{ text: "1234.6", kind: "hour_meter", label: "HRS", confidence: 0.9, alternatives: [] }], primary: 0, problem: null });
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={onSubmit}><TimerPhotoReader onUse={vi.fn()} /></form>);
    await choose();
    await userEvent.type(await screen.findByLabelText(/meter reading at the start/i), "1226.85{Enter}");
    expect(await screen.findByRole("button", { name: /use this/i })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("asks which number is the run time when the panel shows several", async () => {
    reply({
      displays: [
        { text: "06:30", kind: "run_time", label: "", confidence: 0.6, alternatives: [] },
        { text: "58213", kind: "counter", label: "PICK", confidence: 0.9, alternatives: [] },
      ],
      primary: 0, problem: null,
    });
    const onUse = vi.fn();
    render(<TimerPhotoReader onUse={onUse} />);
    await choose();
    await userEvent.click(await screen.findByRole("button", { name: "06:30" }));
    // Picked, but the photo was unclear: confirmed before use.
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await userEvent.click(await screen.findByRole("button", { name: /use this/i }));
    expect(onUse).toHaveBeenCalledWith("6:30:00");
  });

  it("says plainly when the photo can't be used, and offers another", async () => {
    reply({ displays: [], primary: null, problem: "glare" });
    render(<TimerPhotoReader onUse={vi.fn()} />);
    await choose();
    expect(await screen.findByText(/glare on the display/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take another photo/i })).toBeInTheDocument();
  });

  it("sends the shift with the photo, and marks the kept photo the run time came from", async () => {
    post.mockImplementation((url: string) =>
      url === "/ocr/timer"
        ? Promise.resolve({ reading: { displays: [{ text: "07:45:12", kind: "run_time", label: "", confidence: 0.95, alternatives: [] }], primary: 0, problem: null }, suggestionId: "s1", photoId: "p1" })
        : Promise.resolve({ success: true })
    );
    const onUse = vi.fn();
    render(<TimerPhotoReader onUse={onUse} shiftId="sd-1" />);
    await choose();
    const form = post.mock.calls[0][1] as FormData;
    expect(form.get("shiftId")).toBe("sd-1");
    await userEvent.click(await screen.findByRole("button", { name: /use this/i }));
    expect(post).toHaveBeenCalledWith("/ocr/timer/photo/p1/use", { runTime: "7:45:12" });
    expect(post).not.toHaveBeenCalledWith("/ocr/timer/s1/settle", expect.anything()); // settled by the server
    expect(screen.getByText("(photo saved with the shift)")).toBeInTheDocument();
  });

  it("says the photo was kept for verification even when it couldn't be read", async () => {
    post.mockRejectedValue(
      new ApiError("Reading photos isn't set up on this server. Type the run time instead.", 503, undefined, "AI_UNAVAILABLE", {
        details: { photoId: "p2" },
      })
    );
    render(<TimerPhotoReader onUse={vi.fn()} shiftId="sd-1" />);
    await choose();
    expect(await screen.findByText(/saved with this shift for whoever verifies it/)).toBeInTheDocument();
  });

  it("doesn't claim a photo was kept when it wasn't", async () => {
    post.mockRejectedValue(new ApiError("That photo is too large (over 8 MB).", 400));
    render(<TimerPhotoReader onUse={vi.fn()} shiftId="sd-1" />);
    await choose();
    await screen.findByRole("alert");
    expect(screen.queryByText(/saved with this shift/)).not.toBeInTheDocument();
  });

  it("shows the server's refusal, such as AI not being set up", async () => {
    post.mockRejectedValue(new ApiError("Reading photos isn't set up on this server. Type the run time instead.", 503));
    render(<TimerPhotoReader onUse={vi.fn()} />);
    await choose();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/isn't set up/));
  });
});
