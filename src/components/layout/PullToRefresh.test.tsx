import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PULL_THRESHOLD, PullToRefresh, pullDistance } from "./PullToRefresh";

const touch = (type: string, y: number, target: EventTarget = document.body) => {
  const e = new Event(type, { bubbles: true }) as Event & { touches: Array<{ clientY: number }> };
  Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : [{ clientY: y }] });
  Object.defineProperty(e, "target", { value: target });
  act(() => { window.dispatchEvent(e); });
};

const setup = (enabled = true) => {
  const qc = new QueryClient();
  const refetch = vi.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
  render(<QueryClientProvider client={qc}><PullToRefresh enabled={enabled} /></QueryClientProvider>);
  return refetch;
};

afterEach(() => { document.body.style.overflow = ""; });

describe("pull to refresh", () => {
  it("moves at half the finger's speed and stops at a limit", () => {
    expect(pullDistance(-50)).toBe(0);
    expect(pullDistance(100)).toBe(50);
    expect(pullDistance(1000)).toBe(PULL_THRESHOLD * 1.4);
  });

  it("refetches the screen's data when pulled far enough", () => {
    const refetch = setup();
    touch("touchstart", 100);
    touch("touchmove", 100 + PULL_THRESHOLD * 2 + 10);
    expect(screen.getByText("Release to refresh")).toBeInTheDocument();
    touch("touchend", 0);
    expect(refetch).toHaveBeenCalledWith({ type: "active" });
  });

  it("does nothing for a short pull", () => {
    const refetch = setup();
    touch("touchstart", 100);
    touch("touchmove", 140);
    touch("touchend", 0);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("stays out of the way while a dialog has locked the page", () => {
    const refetch = setup();
    document.body.style.overflow = "hidden";
    touch("touchstart", 100);
    touch("touchmove", 400);
    touch("touchend", 0);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("is off outside the installed app, where the browser has its own", () => {
    const refetch = setup(false);
    touch("touchstart", 100);
    touch("touchmove", 400);
    touch("touchend", 0);
    expect(refetch).not.toHaveBeenCalled();
  });
});
