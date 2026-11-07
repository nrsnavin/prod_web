import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuickCreateHost } from "./QuickCreate";
import { quickCreate } from "./quickCreateStore";

// "+ Add" opens the form for the new thing over the page, from what was
// typed, and hands back what was made — or nothing when it is closed.

const saveCategory = vi.fn();
vi.mock("@/features/accounts/hooks", () => ({ useAccountsMutations: () => ({ saveCategory: { mutate: saveCategory, isPending: false }, saveBankAccount: { mutate: vi.fn(), isPending: false } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = () => render(<QueryClientProvider client={new QueryClient()}><QuickCreateHost /></QueryClientProvider>);

describe("quick create", () => {
  it("opens the form from what was typed and resolves with what was made", async () => {
    wrap();
    let made: unknown;
    await act(async () => { void quickCreate("expenseHead", "Courier charges").then((o) => { made = o; }); });
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByLabelText("Name *")).toHaveValue("Courier charges");
    saveCategory.mockImplementation((_b, opts) => opts.onSuccess({ _id: "cat9", name: "Courier charges" }));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(saveCategory.mock.calls[0][0]).toEqual({ body: { name: "Courier charges", ledger: undefined, itcEligible: true } });
    expect(made).toEqual({ value: "cat9", label: "Courier charges" });
    expect(dialog).not.toBeInTheDocument();
  });

  it("closed without saving: nothing", async () => {
    wrap();
    let made: unknown = "pending";
    await act(async () => { void quickCreate("expenseHead", "x").then((o) => { made = o; }); });
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(made).toBeNull();
  });
});
