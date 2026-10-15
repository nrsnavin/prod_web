import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { usePrefillElastics } from "./prefill";

function Page({ onOpen }: { onOpen: () => void }) {
  const { prefill } = usePrefillElastics(onOpen);
  const loc = useLocation();
  return (
    <>
      <p data-testid="prefill">{(prefill ?? []).map((p) => p.name).join(",")}</p>
      <p data-testid="state">{JSON.stringify(loc.state)}</p>
    </>
  );
}

describe("arriving with a selection", () => {
  it("opens the form once with the elastics, and clears the state behind it", () => {
    const open = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/orders", state: { prefillElastics: [{ _id: "a", name: "20mm" }] } }]}>
        <Routes><Route path="/orders" element={<Page onOpen={open} />} /></Routes>
      </MemoryRouter>
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("prefill")).toHaveTextContent("20mm");
    expect(screen.getByTestId("state")).toHaveTextContent("null");
  });

  it("does nothing without one", () => {
    const open = vi.fn();
    render(
      <MemoryRouter initialEntries={["/orders"]}>
        <Routes><Route path="/orders" element={<Page onOpen={open} />} /></Routes>
      </MemoryRouter>
    );
    expect(open).not.toHaveBeenCalled();
  });
});
