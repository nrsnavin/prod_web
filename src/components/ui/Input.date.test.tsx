import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi } from "vitest";
import { Input } from "./Input";

// A native date field writes the date in the browser's order: on a
// US-English browser 10 November is "11/10/2026". At rest the field now
// reads "10 Nov 2026", the way every printed date in the app does.

const label = (container: HTMLElement) => container.querySelector("span[aria-hidden]")?.textContent;

describe("a date field reads the date the app's way", () => {
  it("shows a controlled value as 10 Nov 2026", () => {
    const { container } = render(<Input label="Supply date" type="date" value="2026-11-10" onChange={() => {}} />);
    expect(label(container)).toBe("10 Nov 2026");
    // The field itself still holds the ISO value forms and the API use.
    expect(screen.getByLabelText("Supply date")).toHaveValue("2026-11-10");
  });

  it("asks for a date when empty, instead of showing mm/dd/yyyy", () => {
    const { container } = render(<Input label="Supply date" type="date" defaultValue="" />);
    expect(label(container)).toBe("Pick a date");
  });

  it("hands over to the native editor while focused", () => {
    const { container } = render(<Input label="Supply date" type="date" defaultValue="2026-11-10" />);
    const field = screen.getByLabelText("Supply date");
    fireEvent.focus(field);
    expect(label(container)).toBeUndefined();
    fireEvent.blur(field);
    expect(label(container)).toBe("10 Nov 2026");
  });

  it("follows a value written straight to the field, as a form reset does", () => {
    const { container } = render(<Input label="Supply date" type="date" defaultValue="2026-11-10" />);
    const field = screen.getByLabelText("Supply date") as HTMLInputElement;
    act(() => {
      field.value = "2026-12-25";
    });
    expect(label(container)).toBe("25 Dec 2026");
  });

  it("keeps react-hook-form's setValue and reset in step", async () => {
    let api: ReturnType<typeof useForm<{ due: string }>> | null = null;
    function Form() {
      const form = useForm<{ due: string }>({ defaultValues: { due: "2026-11-10" } });
      api = form;
      return <Input label="Due" type="date" {...form.register("due")} />;
    }
    const { container } = render(<Form />);
    expect(label(container)).toBe("10 Nov 2026");
    act(() => api!.setValue("due", "2027-01-05"));
    expect(label(container)).toBe("5 Jan 2027");
    act(() => api!.reset({ due: "" }));
    expect(label(container)).toBe("Pick a date");
  });

  it("still reports edits through onChange, including after a direct write", () => {
    const onChange = vi.fn();
    function Controlled() {
      const [v, setV] = useState("2026-11-10");
      return (
        <Input label="Due" type="date" value={v} onChange={(e) => { onChange(e.target.value); setV(e.target.value); }} />
      );
    }
    const { container } = render(<Controlled />);
    const field = screen.getByLabelText("Due");
    fireEvent.change(field, { target: { value: "2026-11-20" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-11-20");
    expect(label(container)).toBe("20 Nov 2026");
    fireEvent.change(field, { target: { value: "2026-11-21" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-11-21");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("leaves other fields alone", () => {
    const { container } = render(<Input label="Qty" type="number" defaultValue="5" />);
    expect(container.querySelector("span[aria-hidden]")).toBeNull();
  });
});
