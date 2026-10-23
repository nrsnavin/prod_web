import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QrScanner } from "./QrScanner";

// ══════════════════════════════════════════════════════════════════
//  The scanner reads with the browser's own detector where there is
//  one, and with the bundled decoder everywhere else; what it cannot
//  do without is the camera, and it says why that is missing.
// ══════════════════════════════════════════════════════════════════

const jsqr = vi.fn();
vi.mock("jsqr", () => ({ default: (...a: unknown[]) => jsqr(...a) }));

const win = window as unknown as { BarcodeDetector?: unknown; isSecureContext: boolean };
const nav = navigator as unknown as { mediaDevices?: { getUserMedia: (c: unknown) => Promise<unknown> } };

const track = { stop: vi.fn() };
const stream = { getTracks: () => [track] };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  jsqr.mockReset();
  track.stop.mockClear();
  delete win.BarcodeDetector;
  // jsdom: a video never plays, and a canvas has no drawing context.
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
});
afterEach(() => {
  vi.useRealTimers();
  delete nav.mediaDevices;
});

const giveCamera = () => {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
};

/** A canvas that hands back a frame, so the bundled reader has something to decode. */
const giveCanvas = () => {
  const ctx = { drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(4), width: 640, height: 480 }) };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
};

describe("without a camera", () => {
  it("says the page has to be on https when the address is insecure", () => {
    Object.defineProperty(win, "isSecureContext", { configurable: true, value: false });
    render(<QrScanner onCode={vi.fn()} />);
    expect(screen.getByTestId("scanner-off")).toHaveTextContent(/opened over https/);
    Object.defineProperty(win, "isSecureContext", { configurable: true, value: true });
  });

  it("says the browser has no camera access otherwise", () => {
    Object.defineProperty(win, "isSecureContext", { configurable: true, value: true });
    render(<QrScanner onCode={vi.fn()} />);
    expect(screen.getByTestId("scanner-off")).toHaveTextContent(/no camera access/);
  });

  it("says when the camera was refused", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("no", "NotAllowedError")) },
    });
    giveCanvas();
    render(<QrScanner onCode={vi.fn()} />);
    expect(await screen.findByTestId("scanner-off")).toHaveTextContent(/refused/);
  });
});

describe("reading", () => {
  it("uses the bundled decoder when the browser has none, and reports a code once", async () => {
    giveCamera();
    giveCanvas();
    jsqr.mockReturnValue({ data: "MACHINE|abc|L1" });
    const onCode = vi.fn();
    render(<QrScanner onCode={onCode} />);
    expect(await screen.findByText(/point at the label/i)).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("MACHINE|abc|L1"));
    expect(jsqr).toHaveBeenCalled();
    // The label is still in front of the camera: the same code is one scan.
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(onCode).toHaveBeenCalledTimes(1);
  });

  it("prefers the browser's own detector", async () => {
    giveCamera();
    const detect = vi.fn().mockResolvedValue([{ rawValue: "MACHINE|abc|L2" }]);
    win.BarcodeDetector = class { detect = detect; };
    const onCode = vi.fn();
    render(<QrScanner onCode={onCode} />);
    await screen.findByText(/point at the label/i);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("MACHINE|abc|L2"));
    expect(jsqr).not.toHaveBeenCalled();
  });

  it("stops the camera when it goes away", async () => {
    giveCamera();
    giveCanvas();
    jsqr.mockReturnValue(null);
    const { unmount } = render(<QrScanner onCode={vi.fn()} />);
    await screen.findByText(/point at the label/i);
    unmount();
    expect(track.stop).toHaveBeenCalled();
  });
});
