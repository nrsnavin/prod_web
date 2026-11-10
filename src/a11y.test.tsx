import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import axe from "axe-core";
import { ProgressRail, settle } from "@/components/ui/ProgressRail";
import { PageActions } from "@/components/layout/PageActions";
import { TabStrip } from "@/components/ui/TabStrip";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewDialog } from "@/components/ui/ReviewDialog";

// ══════════════════════════════════════════════════════════════════
//  THE SHARED PIECES PASS AN ACCESSIBILITY CHECK
//
//  axe-core's WCAG 2.1 A and AA rules over the building blocks every
//  screen is made of: names on controls, list and table structure,
//  dialog semantics, ARIA used as it is meant. jsdom draws no pixels, so
//  colour contrast is left to scripts/a11y-audit.mjs, which runs the
//  same rules in a real browser over the app's screens.
// ══════════════════════════════════════════════════════════════════

vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", role: "admin", department: "admin" } }) }));

async function violations(root: Element = document.body) {
  const r = await axe.run(root, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return r.violations.map((v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("accessibility of the shared pieces", () => {
  it("the progress rail", async () => {
    const { container } = render(
      <ProgressRail
        label="Order progress"
        steps={settle([
          { key: "a", label: "Approved", done: true },
          { key: "b", label: "Produced", done: false, detail: "3,500 of 14,000 m" },
          { key: "c", label: "E-way bill", done: false, skipped: true },
          { key: "d", label: "Paid", done: false },
        ])}
      />
    );
    expect(await violations(container)).toEqual([]);
  });

  it("a record's header actions, with More open", async () => {
    const { container, getByRole } = render(
      <PageActions
        primary={{ label: "Approve…", onClick: () => {} }}
        secondary={[{ label: "Edit", onClick: () => {} }]}
        more={[{ label: "Status report", onSelect: () => {} }, { label: "Cancel order…", onSelect: () => {} }]}
      />
    );
    await userEvent.click(getByRole("button", { name: /more/i }));
    expect(await violations(container)).toEqual([]);
  });

  it("a row of tabs", async () => {
    const { container } = render(
      <TabStrip label="Books" active="b" onSelect={() => {}} tabs={[{ id: "a", label: "Banking" }, { id: "b", label: "Month end" }]} />
    );
    expect(await violations(container)).toEqual([]);
  });

  it("a table with sorting, a totals row and the column picker", async () => {
    type Row = { id: string; name: string; metres: number };
    const columns: Column<Row>[] = [
      { key: "name", header: "Elastic", render: (r) => r.name, sort: (r) => r.name },
      { key: "metres", header: "Metres", align: "right", render: (r) => r.metres, total: (rs) => rs.reduce((s, r) => s + r.metres, 0) },
    ];
    const { container } = render(
      <MemoryRouter>
        <DataTable tableId="a11y" columns={columns} rows={[{ id: "1", name: "20mm", metres: 1200 }, { id: "2", name: "12mm", metres: 800 }]} rowKey={(r) => r.id} />
      </MemoryRouter>
    );
    expect(await violations(container)).toEqual([]);
  });

  it("an empty state", async () => {
    const { container } = render(<EmptyState title="No orders yet" description="Orders appear here as soon as they exist." />);
    expect(await violations(container)).toEqual([]);
  });

  it("a review before a big step", async () => {
    render(
      <ReviewDialog
        open
        title="Register with the GST portal"
        rows={[{ label: "Invoice", value: "INV/2026-27/0001" }, { label: "Value", value: "₹29,610" }]}
        confirmLabel="Register with GST portal"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(await violations()).toEqual([]);
  });
});
