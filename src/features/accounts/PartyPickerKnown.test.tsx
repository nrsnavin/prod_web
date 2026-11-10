import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartyPicker } from "./shared";

// A receipt opened for a customer (from the invoice, or ⌘K's "receipt
// from Sunrise") shows that customer in the box straight away, not an
// empty "Search customers…" over a list of Sunrise's invoices.

vi.mock("@/features/customers/api", () => ({ customerService: { list: vi.fn(async () => ({ customers: [] })) } }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: { list: vi.fn(async () => ({ suppliers: [] })) } }));

describe("a party that arrives chosen", () => {
  it("shows its name before any search has run", () => {
    render(<PartyPicker partyType="customer" value="c1" knownName="Sunrise Garments" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Customer" })).toHaveTextContent("Sunrise Garments");
  });

  it("with nothing chosen, asks to search", () => {
    render(<PartyPicker partyType="customer" value="" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Customer" })).toHaveTextContent("Search customers…");
  });
});
