import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Combobox } from "./Combobox";
import { AsyncCombobox } from "./AsyncCombobox";
import { Select } from "./Select";

// Not in the list: add it right there, and it is picked.

function StaticPicker({ onCreate }: { onCreate: (typed: string) => Promise<{ value: string; label: string } | null> }) {
  const [v, setV] = useState("");
  return <><Combobox aria-label="Customer" options={[{ value: "c1", label: "Kumar Knits" }]} value={v} onChange={setV} onCreate={onCreate} createLabel="customer" /><p data-testid="v">{v}</p></>;
}

describe("+ Add in a picker", () => {
  it("offers to add what was typed, and picks it once made", async () => {
    const onCreate = vi.fn(async (typed: string) => ({ value: "c9", label: typed }));
    render(<StaticPicker onCreate={onCreate} />);
    await userEvent.click(screen.getByRole("button", { name: "Customer" }));
    await userEvent.type(screen.getByLabelText("Search Customer"), "Sunrise Garments");
    expect(screen.getByText("No matches")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add “Sunrise Garments” as a new customer" }));
    expect(onCreate).toHaveBeenCalledWith("Sunrise Garments");
    expect(await screen.findByTestId("v")).toHaveTextContent("c9");
    // Shown at once, before the list reloads with it.
    expect(screen.getByRole("button", { name: "Customer" })).toHaveTextContent("Sunrise Garments");
  });

  it("is reached from the keyboard, and nothing is picked when the form is closed", async () => {
    const onCreate = vi.fn(async () => null);
    render(<StaticPicker onCreate={onCreate} />);
    await userEvent.click(screen.getByRole("button", { name: "Customer" }));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onCreate).toHaveBeenCalledWith("");
    expect(screen.getByTestId("v")).toHaveTextContent("");
  });

  it("works on a server-searched picker too", async () => {
    const onChange = vi.fn();
    render(<AsyncCombobox aria-label="Elastic" value="" onChange={onChange} loadOptions={async () => []} onCreate={async (t) => ({ value: "e1", label: t })} createLabel="elastic" />);
    await userEvent.click(screen.getByRole("button", { name: "Elastic" }));
    await userEvent.type(screen.getByLabelText("Search Elastic"), "25mm knitted");
    await userEvent.click(await screen.findByRole("button", { name: "Add “25mm knitted” as a new elastic" }));
    expect(onChange).toHaveBeenCalledWith("e1");
  });

  it("a plain dropdown's last option adds one instead of choosing it", async () => {
    const onCreate = vi.fn();
    const onChange = vi.fn();
    render(<Select label="Head" value="h1" onChange={onChange} options={[{ value: "h1", label: "Freight" }]} onCreate={onCreate} createLabel="expense head" />);
    expect(screen.getByRole("option", { name: "+ Add a new expense head…" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Head"), "+ Add a new expense head…");
    expect(onCreate).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Head")).toHaveValue("h1");
  });

  it("a picker without it offers nothing", async () => {
    render(<Combobox aria-label="Job" options={[]} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Job" }));
    expect(screen.queryByRole("button", { name: /Add/ })).not.toBeInTheDocument();
  });
});
