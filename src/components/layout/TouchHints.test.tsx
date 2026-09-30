import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LONG_PRESS_MS, SHOW_MS, TouchHints, hintSource } from "./TouchHints";

const touch = (type: string, el: Element, x = 10, y = 10) => {
  const e = new Event(type, { bubbles: true }) as Event & { touches: unknown[] };
  Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
  act(() => { el.dispatchEvent(e); });
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (onClick = vi.fn()) => {
  render(
    <>
      <TouchHints enabled />
      <span title="Elastic changeover">changeover</span>
      <button title="Export the training set" onClick={onClick}>Export</button>
      <iframe title="Preview" />
    </>
  );
  return onClick;
};

describe("TouchHints", () => {
  it("shows a badge's hint on a tap, then lets it go", () => {
    setup();
    const badge = screen.getByText("changeover");
    touch("touchstart", badge);
    touch("touchend", badge);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Elastic changeover");
    act(() => { vi.advanceTimersByTime(SHOW_MS + 10); });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("leaves a quick tap on a button alone", () => {
    const onClick = setup();
    const btn = screen.getByRole("button", { name: "Export" });
    touch("touchstart", btn);
    touch("touchend", btn);
    act(() => { btn.click(); });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows a button's hint on a long press, without pressing it", () => {
    const onClick = setup();
    const btn = screen.getByRole("button", { name: "Export" });
    touch("touchstart", btn);
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 10); });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Export the training set");
    touch("touchend", btn);
    act(() => { btn.click(); }); // the click a long press would fire
    expect(onClick).not.toHaveBeenCalled();
    act(() => { btn.click(); }); // the next real tap works again
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the finger was scrolling", () => {
    setup();
    const badge = screen.getByText("changeover");
    touch("touchstart", badge, 10, 10);
    touch("touchmove", badge, 10, 60);
    touch("touchend", badge);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("ignores an iframe's title, which is its name rather than a hint", () => {
    setup();
    expect(hintSource(document.querySelector("iframe"))).toBeNull();
  });
});
