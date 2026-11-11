import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrollRegion } from "./ui";

// A table wider than its box can be reached and scrolled from the
// keyboard; one that fits adds no tab stop.

const widths = (scroll: number, client: number) => {
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(scroll);
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(client);
};

const table = (
  <table>
    <tbody>
      <tr>
        <td>Opening balance</td>
      </tr>
    </tbody>
  </table>
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a table that scrolls sideways", () => {
  it("takes keyboard focus and is named while it overflows", () => {
    widths(640, 360);
    render(<ScrollRegion label="Statement">{table}</ScrollRegion>);
    expect(screen.getByRole("region", { name: "Statement" })).toHaveAttribute("tabindex", "0");
  });

  it("is a plain box with no tab stop while it fits", () => {
    widths(360, 360);
    render(<ScrollRegion label="Statement">{table}</ScrollRegion>);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("table").parentElement).not.toHaveAttribute("tabindex");
  });
});
