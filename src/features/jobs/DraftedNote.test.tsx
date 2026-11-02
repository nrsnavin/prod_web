import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DraftedNote } from "./DraftedNote";

// A floor entry that is not verified yet sits beside the verified
// figure as a draft, and is nothing at all when there is none.

describe("the drafted note", () => {
  it("says what the floor entered and that it is still to verify", () => {
    render(<DraftedNote drafted={2460} />);
    expect(screen.getByText("+ 2,460 m drafted, to verify")).toBeInTheDocument();
    expect(screen.getByTitle(/not verified yet/)).toBeInTheDocument();
  });

  it("is nothing when nothing is drafted", () => {
    const { container } = render(<DraftedNote drafted={0} />);
    expect(container).toBeEmptyDOMElement();
    expect(render(<DraftedNote />).container).toBeEmptyDOMElement();
  });
});
