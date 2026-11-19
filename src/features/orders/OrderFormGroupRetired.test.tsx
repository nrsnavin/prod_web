import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderForm } from "./OrderForm";

// Credit control reads the server; these tests are about the form itself.
vi.mock("@/features/customers/credit", () => ({
  CreditBand: () => null,
  useCreditHold: () => ({ run: (fn: (o?: string) => void) => fn(undefined), onError: () => false, dialog: null }),
}));

// ══════════════════════════════════════════════════════════════════
//  A GROUP THAT NAMES A RETIRED ELASTIC, OR ONE ELASTIC TWICE
//
//  A saved group names its elastics for good. One archived since is
//  out of every picker on the order form — and "add from group" put it
//  on the order anyway. And a group saved with one elastic on two lines
//  (the server now refuses that; older groups may hold one) filled the
//  form with a pair of lines the order would not save.
// ══════════════════════════════════════════════════════════════════

const GROUP = {
  _id: "g1",
  name: "Summer bundle",
  customer: "c1",
  items: [
    { elastic: { _id: "e1", name: "20mm Elastic" }, defaultQuantity: 500 },
    { elastic: { _id: "e2", name: "32mm Elastic", archived: true }, defaultQuantity: 250 },
    { elastic: { _id: "e1", name: "20mm Elastic" }, defaultQuantity: 100 },
    { elastic: { _id: "e3", name: "40mm Elastic" }, defaultQuantity: 75 },
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

async function addTheGroup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Select customer"));
  await user.click(await screen.findByText("Acme Textiles"));
  await user.click(await screen.findByText("Select a group…"));
  await user.click(await screen.findByText(/Summer bundle/));
}

beforeEach(() => vi.clearAllMocks());

describe("adding a group with a retired elastic and a repeated one", () => {
  it("adds each live elastic once, at its first quantity", async () => {
    const user = userEvent.setup();
    renderForm();
    await addTheGroup(user);

    await screen.findByText("40mm Elastic");
    await waitFor(() => {
      const qtys = screen.getAllByLabelText(/Qty \(m\)/i) as HTMLInputElement[];
      // Before: four lines — 20mm twice, and the archived 32mm.
      expect(qtys.map((q) => q.value)).toEqual(["500", "75"]);
    });
  });

  it("says which elastic it left off, and why", async () => {
    const user = userEvent.setup();
    renderForm();
    await addTheGroup(user);

    expect(await screen.findByText(/Left off .*archived.*32mm Elastic/)).toBeInTheDocument();
  });
});
