import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { QuoteCreatePage } from "./QuoteCreatePage";

// ══════════════════════════════════════════════════════════════════
//  THE COSTING SHEET
//
//  Four named rows to start with — warp yarn, spandex covering, warp
//  spandex, weft yarn — each removable, and any number of rows can be
//  added after them for whatever else a cloth needs.
//
//  The sheet prices as you type, but what it SENDS is only weights and
//  rates. The totals on screen are the browser's working; the server
//  does the sum again and its answer is what gets stored and printed.
//  So the request body carrying a total would be a bug, not a
//  convenience — these hold that it never does.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const createMutate = vi.fn();

vi.mock("./hooks", () => ({
  useQuoteMutations: () => ({ create: { mutate: createMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/features/customers/api", () => ({
  customerService: {
    list: vi.fn().mockResolvedValue({
      customers: [{ _id: "c1", name: "Ravi Textiles" }],
      total: 1, page: 1, pages: 1,
    }),
  },
}));

// A DATA router, because that is what the app mounts this page in and
// what the unsaved-changes guard's useBlocker requires. A plain
// MemoryRouter renders the page but throws the moment the guard asks
// whether a navigation should be blocked — the test would be checking
// a page that cannot exist.
const renderPage = () =>
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          { path: "/quotes/new", element: <QuoteCreatePage /> },
          // Somewhere for the guard to block a navigation TO.
          { path: "/quotes", element: <div>Quotations</div> },
        ],
        { initialEntries: ["/quotes/new"] }
      )}
    />
  );

const weight = (material: string, product = 1) =>
  screen.getByLabelText(
    new RegExp(`weight in grams for ${material} in product ${product}`, "i")
  );
const rate = (material: string, product = 1) =>
  screen.getByLabelText(
    new RegExp(`rate per kilogram for ${material} in product ${product}`, "i")
  );

/** Switch to typing a customer rather than picking one. */
const typeCustomer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /enter a new customer/i }));
  await user.type(screen.getByLabelText(/^customer \*/i), "Ravi Textiles");
};

/** Enough to get past the guards. */
const fillHeader = async (user: ReturnType<typeof userEvent.setup>) => {
  await typeCustomer(user);
  await user.type(screen.getAllByLabelText(/^product \*/i)[0], "20mm Woven Elastic");
};

beforeEach(() => {
  toast.mockClear();
  createMutate.mockClear();
});

describe("the rows the sheet ships with", () => {
  it("names all four", () => {
    renderPage();
    for (const m of ["Warp yarn", "Spandex covering", "Warp spandex", "Weft yarn"]) {
      expect(weight(m)).toBeInTheDocument();
    }
  });

  it("will not let their names be edited", () => {
    renderPage();
    expect(screen.getByLabelText(/warp yarn name/i)).toHaveAttribute("readonly");
  });

  it("lets one be removed", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /remove weft yarn/i }));

    expect(screen.queryByLabelText(/weight in grams for weft yarn/i)).not.toBeInTheDocument();
    expect(weight("Warp yarn")).toBeInTheDocument();
  });

  it("puts them back on reset", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /remove weft yarn/i }));
    await user.click(screen.getByRole("button", { name: /reset rows/i }));

    expect(weight("Weft yarn")).toBeInTheDocument();
  });
});

describe("rows added after the four", () => {
  it("adds a blank, nameable row", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /add material/i }));

    const names = screen.getAllByPlaceholderText("Material");
    const added = names[names.length - 1];
    expect(added).not.toHaveAttribute("readonly");

    await user.type(added, "Dye");
    expect(weight("Dye")).toBeInTheDocument();
  });

  it("prices it alongside the fixed four", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");

    await user.click(screen.getByRole("button", { name: /add material/i }));
    const names = screen.getAllByPlaceholderText("Material");
    await user.type(names[names.length - 1], "Dye");
    await user.type(weight("Dye"), "0.5");
    await user.type(rate("Dye"), "400");

    // 1.008 + 0.2 = 1.208 of material, + 1.25 conversion = ₹2.4580/m.
    // The added row is priced into the product's cost exactly like the
    // four it shipped with.
    expect(await screen.findByText(/₹2\.4580\/m/)).toBeInTheDocument();
  });
});

describe("the price as you type", () => {
  it("shows the rate before anything is saved", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");

    // 1.008 material + 1.25 conversion = 2.258, × 1.20 = 2.7096 → ₹2.71
    expect((await screen.findAllByText(/₹2\.71/)).length).toBeGreaterThan(0);
  });

  it("recomputes when the margin changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");
    const margin = screen.getByLabelText(/margin percent for product 1/i);
    await user.clear(margin);
    await user.type(margin, "50");

    // 2.258 × 1.50 = 3.387 → ₹3.39
    expect((await screen.findAllByText(/₹3\.39/)).length).toBeGreaterThan(0);
  });
});

describe("what gets sent", () => {
  const fillOneMaterial = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");
  };

  it("sends weights and rates, never a total", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillOneMaterial(user);
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const body = createMutate.mock.calls[0][0];

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].materials).toEqual([
      { label: "Warp yarn", weightGrams: 4.2, ratePerKg: 240 },
    ]);
    // The server prices it. A total in the body would let a stale tab
    // set a price this business is bound by.
    expect(body).not.toHaveProperty("subTotal");
    expect(body).not.toHaveProperty("grandTotal");
    expect(body.lines[0]).not.toHaveProperty("rateBeforeTax");
  });

  it("leaves out the rows nobody filled in", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillOneMaterial(user);
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0].lines[0].materials).toHaveLength(1);
  });

  it("carries the margin, GST and conversion defaults", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillOneMaterial(user);
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const b = createMutate.mock.calls[0][0];
    expect(b.gstPercent).toBe(5);
    expect(b.lines[0]).toMatchObject({ conversionCost: 1.25, marginPercent: 20 });
  });

  it("defaults the validity to thirty days out", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillOneMaterial(user);
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const { date, validTill } = createMutate.mock.calls[0][0];
    const days = (new Date(validTill).getTime() - new Date(date).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });
});

describe("what the sheet refuses to send", () => {
  it("will not quote without a customer", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    expect(createMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/pick a customer/i), "error");
  });

  it("will not quote without a product name", async () => {
    const user = userEvent.setup();
    renderPage();
    await typeCustomer(user);
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    expect(createMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/product 1 needs a name/i), "error"
    );
  });

  it("will not quote with no material priced", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    expect(createMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/at least one material/i), "error"
    );
  });

  it("will not send an added row that was filled in but never named", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /add material/i }));

    // Figures but no name — it would print as a blank line. An unnamed
    // row labels itself "material" until it is called something.
    await user.type(screen.getByLabelText(/weight in grams for material in product 1/i), "1");
    await user.type(screen.getByLabelText(/rate per kilogram for material in product 1/i), "100");

    await user.click(screen.getByRole("button", { name: /raise quotation/i }));
    expect(createMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/needs a material name/i), "error"
    );
  });
});

// ══════════════════════════════════════════════════════════════════
describe("several products on one quotation", () => {
  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    product: number,
    name: string,
    grams: string,
    ratePerKg: string
  ) => {
    await user.type(screen.getAllByLabelText(/^product \*/i)[product - 1], name);
    await user.type(weight("Warp yarn", product), grams);
    await user.type(rate("Warp yarn", product), ratePerKg);
  };

  it("adds a second product with its own four rows", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /add another product/i }));

    expect(screen.getAllByLabelText(/^product \*/i)).toHaveLength(2);
    expect(weight("Warp yarn", 2)).toBeInTheDocument();
  });

  it("prices each product on its own margin", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /add another product/i }));

    await fill(user, 1, "20mm Woven", "4.2", "240");
    await fill(user, 2, "32mm Knitted", "8", "240");

    const margin2 = screen.getByLabelText(/margin percent for product 2/i);
    await user.clear(margin2);
    await user.type(margin2, "50");

    // P1: 1.008 + 1.25 = 2.258 × 1.20 → ₹2.71
    // P2: 1.92  + 1.25 = 3.17  × 1.50 → ₹4.76
    expect((await screen.findAllByText(/₹2\.71/)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/₹4\.76/)).length).toBeGreaterThan(0);
  });

  it("adds the products into one grand total", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /add another product/i }));

    await fill(user, 1, "20mm Woven", "4.2", "240");
    await user.type(screen.getByLabelText(/quantity for product 1/i), "5000");
    await fill(user, 2, "32mm Knitted", "8", "240");
    await user.type(screen.getByLabelText(/quantity for product 2/i), "3000");

    // P1 1.008 + 1.25 = 2.258 × 1.20 → 2.71 ; × 5000 = 13,550
    // P2 1.92  + 1.25 = 3.17  × 1.20 → 3.80 ; × 3000 = 11,400
    expect(await screen.findByText("₹24,950.00")).toBeInTheDocument();
  });

  it("sends one line per product", async () => {
    const user = userEvent.setup();
    renderPage();
    await typeCustomer(user);
    await user.click(screen.getByRole("button", { name: /add another product/i }));
    await fill(user, 1, "20mm Woven", "4.2", "240");
    await fill(user, 2, "32mm Knitted", "8", "240");

    await user.click(screen.getByRole("button", { name: /raise quotation/i }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());

    const { lines } = createMutate.mock.calls[0][0];
    expect(lines).toHaveLength(2);
    expect(lines[0].productName).toBe("20mm Woven");
    expect(lines[1].productName).toBe("32mm Knitted");
  });

  it("names the product that is not filled in", async () => {
    const user = userEvent.setup();
    renderPage();
    await typeCustomer(user);
    await fill(user, 1, "20mm Woven", "4.2", "240");
    await user.click(screen.getByRole("button", { name: /add another product/i }));
    await user.type(screen.getAllByLabelText(/^product \*/i)[1], "32mm Knitted");
    // ...but no materials on it.

    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    expect(createMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/product 2.*at least one material/i), "error"
    );
  });

  it("can drop a product again, but never the last one", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /add another product/i }));
    await user.click(screen.getByRole("button", { name: /remove product 2/i }));

    expect(screen.getAllByLabelText(/^product \*/i)).toHaveLength(1);
    // The only product has no remove button — a quotation with nothing on
    // it is not a quotation.
    expect(screen.queryByRole("button", { name: /remove product 1/i })).not.toBeInTheDocument();
  });
});

describe("choosing the customer", () => {
  it("offers the master list first", () => {
    renderPage();
    // The combobox is labelled; its placeholder is button text, not an
    // input placeholder.
    expect(screen.getByLabelText(/^customer$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter a new customer/i })).toBeInTheDocument();
  });

  it("sends the picked customer's id", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText(/^customer$/i));
    await user.click(await screen.findByText("Ravi Textiles"));

    await user.type(screen.getAllByLabelText(/^product \*/i)[0], "20mm Woven");
    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0].customer).toBe("c1");
  });

  it("switches to a typed customer and sends no id", async () => {
    const user = userEvent.setup();
    renderPage();
    await typeCustomer(user);
    await user.type(screen.getAllByLabelText(/^product \*/i)[0], "20mm Woven");
    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const body = createMutate.mock.calls[0][0];
    expect(body).not.toHaveProperty("customer");
    expect(body.customerName).toBe("Ravi Textiles");
  });

  it("will not save with the picker showing and nothing picked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getAllByLabelText(/^product \*/i)[0], "20mm Woven");
    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    expect(createMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/pick a customer/i), "error");
  });
});
