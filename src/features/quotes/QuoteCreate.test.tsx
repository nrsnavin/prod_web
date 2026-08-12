import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

const renderPage = () =>
  render(
    <MemoryRouter>
      <QuoteCreatePage />
    </MemoryRouter>
  );

const weight = (material: string) =>
  screen.getByLabelText(new RegExp(`weight in grams for ${material}`, "i"));
const rate = (material: string) =>
  screen.getByLabelText(new RegExp(`rate per kilogram for ${material}`, "i"));

/** Enough to get past the guards. */
const fillHeader = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/^customer \*/i), "Ravi Textiles");
  await user.type(screen.getByLabelText(/^product \*/i), "20mm Woven Elastic");
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

    // 1.008 + 0.2. The figure shows in both the sheet footer and the
    // price panel, which is the point — they are the same number.
    const shown = await screen.findAllByText("₹1.2080");
    expect(shown.length).toBeGreaterThanOrEqual(1);
  });
});

describe("the price as you type", () => {
  it("shows the rate before anything is saved", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");

    // 1.008 material + 1.25 conversion = 2.258, × 1.20 = 2.7096
    expect(await screen.findByText("₹2.7096")).toBeInTheDocument();
  });

  it("recomputes when the margin changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(weight("Warp yarn"), "4.2");
    await user.type(rate("Warp yarn"), "240");
    const margin = screen.getByLabelText(/margin %/i);
    await user.clear(margin);
    await user.type(margin, "50");

    // 2.258 × 1.50
    expect(await screen.findByText("₹3.3870")).toBeInTheDocument();
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

    expect(body.materials).toEqual([
      { label: "Warp yarn", weightGrams: 4.2, ratePerKg: 240 },
    ]);
    // The server prices it. A total in the body would let a stale tab
    // set a price this business is bound by.
    expect(body).not.toHaveProperty("rateBeforeTax");
    expect(body).not.toHaveProperty("totalCost");
    expect(body).not.toHaveProperty("rateInclTax");
  });

  it("leaves out the rows nobody filled in", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillOneMaterial(user);
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0].materials).toHaveLength(1);
  });

  it("carries the margin, GST and conversion defaults", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillOneMaterial(user);
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      conversionCost: 1.25,
      marginPercent: 20,
      gstPercent: 5,
    });
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
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/who is this quote for/i), "error");
  });

  it("will not quote without a product", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/^customer \*/i), "Ravi Textiles");
    await user.click(screen.getByRole("button", { name: /raise quotation/i }));

    expect(createMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/name the product/i), "error");
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
    await user.type(screen.getByLabelText(/weight in grams for material$/i), "1");
    await user.type(screen.getByLabelText(/rate per kilogram for material$/i), "100");

    await user.click(screen.getByRole("button", { name: /raise quotation/i }));
    expect(createMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/needs a material name/i), "error"
    );
  });
});
