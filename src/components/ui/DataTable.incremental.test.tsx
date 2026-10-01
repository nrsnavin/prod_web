import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Column, DataTable, RENDER_STEP } from "./DataTable";

// ══════════════════════════════════════════════════════════════════
//  LONG LISTS, A SCREENFUL AT A TIME
//
//  Past RENDER_STEP rows the table draws the first RENDER_STEP and adds
//  more on demand; sorting still covers every row; a short list is
//  exactly as it was. On a phone, the same for the cards.
// ══════════════════════════════════════════════════════════════════

type Row = { id: string; n: number };
const make = (count: number): Row[] => Array.from({ length: count }, (_, i) => ({ id: String(i), n: i }));
const columns: Column<Row>[] = [{ key: "n", header: "N", render: (r) => `row-${r.n}`, sort: (r) => r.n }];

function asViewport(phone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({
      matches: phone && q.includes("max-width"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}
afterEach(() => asViewport(false));

const drawn = () => screen.queryAllByText(/^row-\d+$/).length;

describe.each([false, true])("phone=%s", (phone) => {
  it("leaves a short list exactly as it was", () => {
    asViewport(phone);
    render(<DataTable columns={columns} rows={make(150)} rowKey={(r) => r.id} />);
    expect(drawn()).toBe(150);
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("draws a long list a step at a time", async () => {
    asViewport(phone);
    render(<DataTable columns={columns} rows={make(450)} rowKey={(r) => r.id} />);
    expect(drawn()).toBe(RENDER_STEP);
    expect(screen.getByText(`Showing ${RENDER_STEP} of 450`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(drawn()).toBe(RENDER_STEP * 2);
    await userEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(drawn()).toBe(450);
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("sorts every row, not only the ones drawn", () => {
    asViewport(phone);
    render(<DataTable columns={columns} rows={make(450)} rowKey={(r) => r.id} defaultSortKey="n" defaultSortDir={-1} />);
    // The largest of all 450 comes first, though only 200 are drawn.
    expect(screen.getAllByText(/^row-\d+$/)[0]).toHaveTextContent("row-449");
  });
});
