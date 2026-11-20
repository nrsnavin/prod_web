import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JournalForm } from "./JournalForm";
import type { OpenDoc } from "./types";

// A journal line set against a party's open documents fills each tick with
// what is left of the line. 100.10 less 33.37 is 66.73 — and
// 66.72999999999999 to the arithmetic, which is what the box showed and
// what went to the server.

const docs: OpenDoc[] = [
  { docType: "Invoice", id: "i1", docNo: "INV/0001", date: "2026-06-01", dueDate: "2026-07-01", party: "c1", partyName: "Sunrise", amount: 33.37, outstanding: 33.37, overdueDays: 0, bucket: "current" },
  { docType: "Invoice", id: "i2", docNo: "INV/0002", date: "2026-06-02", dueDate: "2026-07-02", party: "c1", partyName: "Sunrise", amount: 500, outstanding: 500, overdueDays: 0, bucket: "current" },
];
vi.mock("./hooks", () => ({
  useAccountsMutations: () => ({ createJournal: { mutate: vi.fn(), isPending: false } }),
  useBankAccounts: () => ({ data: [] }),
  useCategories: () => ({ data: [{ _id: "h1", name: "Freight" }, { _id: "h2", name: "Old head", active: false }] }),
  useOpenDocs: (_t?: string, party?: string) => ({ data: party ? { docs, balance: 0 } : undefined }),
}));
vi.mock("./api", () => ({ accountsService: {} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// The picker is a search box; the test needs only "a customer was picked".
vi.mock("./shared", async (orig) => ({
  ...(await orig<typeof import("./shared")>()),
  PartyPicker: ({ onChange }: { onChange: (id: string, name: string) => void }) => <button type="button" onClick={() => onChange("c1", "Sunrise")}>pick Sunrise</button>,
}));

const wrap = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><JournalForm onDone={() => {}} onCancel={() => {}} /></MemoryRouter></QueryClientProvider>);

describe("a journal line set against open documents", () => {
  it("fills what is left of the line in paise, not in a float's tail", async () => {
    wrap();
    await userEvent.click(screen.getByRole("button", { name: "pick Sunrise" }));
    await userEvent.type(screen.getAllByLabelText("Credit")[0], "100.1");
    await userEvent.click(screen.getByLabelText("Set against INV/0001"));
    await userEvent.click(screen.getByLabelText("Set against INV/0002"));
    expect(screen.getByLabelText("Amount against INV/0001")).toHaveValue(33.37);
    expect(screen.getByLabelText("Amount against INV/0002")).toHaveValue(66.73);
  });

  it("offers only the heads still in use", async () => {
    wrap();
    await userEvent.selectOptions(screen.getByLabelText("Line 2"), "head");
    const options = Array.from(screen.getByLabelText("Head").querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toContain("Freight");
    expect(options).not.toContain("Old head");
  });
});
