import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { NewMenu } from "./AccountsPage";

// Every voucher from one button, wherever you are in accounts.

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
const wrap = () => render(<MemoryRouter initialEntries={["/accounts/bills"]}><Routes><Route path="*" element={<><NewMenu /><Where /></>} /></Routes></MemoryRouter>);

describe("+ New", () => {
  it("lists every voucher, each opening its own form", async () => {
    wrap();
    await userEvent.click(screen.getByRole("button", { name: /New/ }));
    const items = screen.getAllByRole("menuitem").map((m) => m.textContent?.replace(/(Money|Lower|Charge|Cheques|Bank|Pick).*/, "").trim());
    expect(items).toEqual(["Receipt", "Payment", "Deposit cheques / cash", "Transfer between accounts", "Supplier bill", "Expense", "Credit note", "Debit note to supplier", "Debit note to customer", "Refund", "Journal"]);
    await userEvent.click(screen.getByRole("menuitem", { name: /Credit note/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts/notes?new=credit");
    await userEvent.click(screen.getByRole("button", { name: /New/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Transfer between accounts/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts/vouchers?new=contra");
  });
});
