import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderForm } from "./OrderForm";

// ══════════════════════════════════════════════════════════════════
//  "ADD FROM ELASTIC GROUP" LEFT THE LINES LOOKING EMPTY
//
//  Picking a saved group is meant to drop all its elastics onto the
//  order at once. The values landed — the form would have submitted
//  correctly — but every elastic box still read "Select elastic", so
//  the shortcut looked broken and the lines got typed in by hand.
//
//  The fault was one level down, in AsyncCombobox: the label for a
//  value was resolved from a ref-backed cache filled by an effect, and
//  an effect runs after the render that needs it while a ref write
//  schedules no re-render. Any combobox that mounts with a value
//  already set therefore painted empty and stayed empty — and
//  react-hook-form's replace()/append() give the rows new keys, so
//  "add from group" mounts fresh ones every time.
//
//  This test works the control the operator works, so the fix is held
//  at the level the complaint was made at rather than one layer below
//  it. See AsyncCombobox.seed.test.tsx for the unit-level case.
// ══════════════════════════════════════════════════════════════════

const GROUP = {
  _id: "g1",
  name: "Summer bundle",
  customer: "c1",
  items: [
    { elastic: { _id: "e1", name: "20mm Elastic" }, defaultQuantity: 500 },
    { elastic: { _id: "e2", name: "32mm Elastic" }, defaultQuantity: 250 },
  ],
};

vi.mock("@/features/elasticGroups/hooks", () => ({
  useElasticGroups: () => ({ data: [GROUP], isLoading: false }),
}));

vi.mock("@/features/customers/api", () => ({
  customerService: {
    search: vi.fn().mockResolvedValue([{ _id: "c1", name: "Acme Textiles" }]),
    list: vi.fn().mockResolvedValue({ customers: [{ _id: "c1", name: "Acme Textiles" }] }),
  },
}));

// The elastic search deliberately returns NOTHING: a group's elastics
// must render from the seed alone, without the operator opening a
// dropdown or the server being asked.
vi.mock("@/features/elastics/api", () => ({
  elasticService: {
    search: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue({ elastics: [] }),
  },
}));

vi.mock("./OrderEtaPanel", () => ({ OrderEtaPanel: () => null }));

const renderForm = () =>
  render(<OrderForm submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

/** Pick the customer, then the group — the operator's actual sequence.
 *  Both triggers are plain buttons showing their placeholder. */
async function addTheGroup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Select customer"));
  await user.click(await screen.findByText("Acme Textiles"));

  await user.click(await screen.findByText("Select a group…"));
  await user.click(await screen.findByText(/Summer bundle/));
}

beforeEach(() => vi.clearAllMocks());

describe("adding elastics from a group", () => {
  it("fills the elastic on every line it adds", async () => {
    const user = userEvent.setup();
    renderForm();
    await addTheGroup(user);

    expect(await screen.findByText("20mm Elastic")).toBeInTheDocument();
    expect(await screen.findByText("32mm Elastic")).toBeInTheDocument();
  });

  it("leaves no line still saying 'Select elastic'", async () => {
    // The complaint as an invariant: after the shortcut runs, no line
    // may still be showing its placeholder.
    const user = userEvent.setup();
    renderForm();
    await addTheGroup(user);

    await screen.findByText("20mm Elastic");
    expect(screen.queryByText("Select elastic")).not.toBeInTheDocument();
  });

  it("fills the quantities from the group's defaults", async () => {
    const user = userEvent.setup();
    renderForm();
    await addTheGroup(user);

    await waitFor(() => {
      const qtys = screen.getAllByLabelText(/Qty \(m\)/i) as HTMLInputElement[];
      expect(qtys.map((q) => q.value)).toEqual(["500", "250"]);
    });
  });

  it("replaces the blank starting row rather than adding after it", async () => {
    // A group of two must give two lines, not an empty one plus two.
    const user = userEvent.setup();
    renderForm();
    await addTheGroup(user);

    await screen.findByText("20mm Elastic");
    expect(screen.getAllByLabelText(/Qty \(m\)/i)).toHaveLength(2);
  });
});
