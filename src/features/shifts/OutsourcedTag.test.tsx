import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutsourcedTag, OutsourcedMark, outsourcedLabel } from "./OutsourcedTag";

// The marker must be SILENT for in-house work. If every job carried a
// badge the exceptional case would stop standing out, which is the whole
// point of flagging outsourced jobs on the shift screens.

describe("OutsourcedTag", () => {
  it("names the vendor when the job is outsourced", () => {
    render(<OutsourcedTag productionMode="outsource" outsourceVendor="Sunrise Weaving" />);
    expect(screen.getByText(/Outsourced — Sunrise Weaving/)).toBeInTheDocument();
  });

  it("still marks it when no vendor is recorded", () => {
    render(<OutsourcedTag productionMode="outsource" />);
    expect(screen.getByText("Outsourced")).toBeInTheDocument();
  });

  it("renders nothing for in-house work", () => {
    const { container } = render(<OutsourcedTag productionMode="in_house" />);
    expect(container).toBeEmptyDOMElement();
  });

  // An older job document, or a response whose projection forgot the
  // field, arrives undefined — that must read as in-house, not as a
  // badge on every row.
  it("renders nothing when the mode is missing entirely", () => {
    const { container } = render(<OutsourcedTag />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OutsourcedMark (compact, for table cells)", () => {
  it("marks an outsourced row and carries the vendor in its tooltip", () => {
    render(<OutsourcedMark productionMode="outsource" outsourceVendor="Sunrise Weaving" />);
    const el = screen.getByText("Outsourced");
    expect(el).toBeInTheDocument();
    expect(el.closest("[title]")).toHaveAttribute("title", "Outsourced — Sunrise Weaving");
  });

  it("renders nothing for in-house work", () => {
    const { container } = render(<OutsourcedMark productionMode="in_house" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("outsourcedLabel", () => {
  it("appends the vendor only when there is one", () => {
    expect(outsourcedLabel("Sunrise")).toBe("Outsourced — Sunrise");
    expect(outsourcedLabel("")).toBe("Outsourced");
    expect(outsourcedLabel(undefined)).toBe("Outsourced");
  });
});
