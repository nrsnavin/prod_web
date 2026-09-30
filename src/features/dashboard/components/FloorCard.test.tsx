import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FloorCard, type FloorCardProps } from "./FloorCard";

const show = (props: FloorCardProps) =>
  render(<MemoryRouter><FloorCard {...props} /></MemoryRouter>);

describe("FloorCard", () => {
  it("leads with looms running, metres so far and late orders, each linking to its screen", () => {
    show({
      looms: { running: 6, maintenance: 1, total: 8 },
      metres: { today: 1240, yesterday: 31000 },
      lateOrders: { count: 3 },
    });
    expect(screen.getByRole("link", { name: /looms running/i })).toHaveAttribute("href", "/machines");
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText(/75% of the plant · 1 in maintenance/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /metres today/i })).toHaveAttribute("href", "/production");
    expect(screen.getByText("1,240")).toBeInTheDocument();
    expect(screen.getByText(/yesterday 31,000 m/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /late orders/i })).toHaveAttribute("href", "/orders");
    expect(screen.getByText("3")).toHaveClass("text-status-danger");
  });

  it("says when nothing is late, in plain words", () => {
    show({ lateOrders: { count: 0 } });
    expect(screen.getByText("Everything on time")).toBeInTheDocument();
    expect(screen.getByText("0")).not.toHaveClass("text-status-danger");
  });

  it("does not claim zero late orders when an older server didn't say", () => {
    show({ lateOrders: { count: undefined } });
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Everything on time")).toBeNull();
  });

  it("leaves out what the department cannot open, and renders nothing when that is everything", () => {
    const { container, rerender } = show({ metres: { today: 0, yesterday: 0 } });
    expect(screen.queryByRole("link", { name: /looms running/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /late orders/i })).toBeNull();
    rerender(<MemoryRouter><FloorCard /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
