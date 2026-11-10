import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { matchActions, parseIntent, voucherFor } from "./paletteActions";
import { useOpenOnArrival } from "@/core/hooks/useUrlState";

// ══════════════════════════════════════════════════════════════════
//  ⌘K STARTS WORK, AND THE KEYS GET PEOPLE AROUND
//
//  "new order" opens the order form, "receipt from Sunrise" opens a
//  receipt with Sunrise chosen, "go to J-4" finds J-4. G then a letter
//  goes to a page, ? lists the keys; none of them fires while someone is
//  typing. An action is offered only to someone who may open its page.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...a) } }));
let user: Record<string, unknown> = { id: "u1", role: "admin", department: "admin" };
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));

import { GlobalSearch } from "./GlobalSearch";
import { useShortcuts, ShortcutsSheet } from "./Shortcuts";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

beforeEach(() => {
  user = { id: "u1", role: "admin", department: "admin" };
  get.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url === "/customer/all-customers") return { customers: [{ _id: "c1", name: "Sunrise Garments" }] };
    if (url === "/supplier/get-suppliers") return { suppliers: [{ _id: "s1", name: "Lakshmi Yarns" }] };
    if (url === "/job/jobs") return { jobs: [{ _id: "j4", jobOrderNo: 4, customer: { name: "Kaveri" } }] };
    return {};
  });
});

describe("reading what was typed", () => {
  it.each([
    ["receipt from Sunrise", { kind: "receipt", party: "Sunrise" }],
    ["record receipt sunrise garments", { kind: "receipt", party: "sunrise garments" }],
    ["pay Lakshmi Yarns", { kind: "payment", party: "Lakshmi Yarns" }],
    ["payment to lakshmi", { kind: "payment", party: "lakshmi" }],
    ["go to J-4", { kind: "goto", rest: "J-4" }],
    ["open #4", { kind: "goto", rest: "#4" }],
  ])("%p", (q, intent) => {
    expect(parseIntent(q)).toEqual(intent);
  });

  it("a plain search is no phrase", () => {
    expect(parseIntent("Sunrise")).toBeNull();
    expect(parseIntent("receipt")).toBeNull();
  });

  it("matches actions by their names and the words people use", () => {
    expect(matchActions("new order").map((a) => a.label)).toEqual(["New order"]);
    expect(matchActions("new po").map((a) => a.label)).toEqual(["New purchase order"]);
    expect(matchActions("money in").map((a) => a.label)).toEqual(["Record receipt"]);
    expect(matchActions("J-4")).toEqual([]);
    expect(matchActions("")).toEqual([]);
  });

  it("a voucher for a party carries the party", () => {
    expect(voucherFor("receipt", { id: "c1", name: "Sunrise & Co" })).toBe("/accounts/vouchers?new=receipt&party=c1&partyName=Sunrise+%26+Co");
  });
});

const palette = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/"]}>
        <GlobalSearch open onClose={() => {}} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("actions in search", () => {
  it("“new order” opens the order form", async () => {
    palette();
    await userEvent.type(screen.getByLabelText("Search everything"), "new order");
    expect(screen.getByRole("button", { name: /New order/ })).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/orders?new=1");
  });

  it("“receipt from Sunrise” offers a receipt with Sunrise chosen", async () => {
    palette();
    await userEvent.type(screen.getByLabelText("Search everything"), "receipt from Sunrise");
    await userEvent.click(await screen.findByRole("button", { name: /Record receipt from Sunrise Garments/ }));
    expect(get).toHaveBeenCalledWith("/customer/all-customers", expect.objectContaining({ search: "Sunrise" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts/vouchers?new=receipt&party=c1&partyName=Sunrise+Garments");
  });

  it("“pay Lakshmi” looks among the suppliers", async () => {
    palette();
    await userEvent.type(screen.getByLabelText("Search everything"), "pay Lakshmi");
    expect(await screen.findByRole("button", { name: /Record payment to Lakshmi Yarns/ })).toBeInTheDocument();
  });

  it("“go to J-4” finds J-4", async () => {
    palette();
    await userEvent.type(screen.getByLabelText("Search everything"), "go to J-4");
    expect(await screen.findByText("Job J-4")).toBeInTheDocument();
  });

  it("offers no action whose page the person may not open", async () => {
    user = { id: "u2", role: "production", department: "production" };
    palette();
    await userEvent.type(screen.getByLabelText("Search everything"), "receipt");
    expect(screen.queryByRole("button", { name: /Record receipt/ })).not.toBeInTheDocument();
  });
});

function Keys({ onSearch, onHelp }: { onSearch: () => void; onHelp: () => void }) {
  useShortcuts({ toggleSearch: onSearch, openSearch: onSearch, openHelp: onHelp });
  return (
    <>
      <input aria-label="A field" />
      <Where />
    </>
  );
}

describe("keys", () => {
  const keys = () => {
    const onSearch = vi.fn();
    const onHelp = vi.fn();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Keys onSearch={onSearch} onHelp={onHelp} />
      </MemoryRouter>
    );
    return { onSearch, onHelp };
  };

  it("G then O goes to the orders", () => {
    keys();
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "o" });
    expect(screen.getByTestId("where")).toHaveTextContent("/orders");
  });

  it("? opens the list of keys, / and ⌘K open search", () => {
    const { onSearch, onHelp } = keys();
    fireEvent.keyDown(window, { key: "?" });
    expect(onHelp).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "/" });
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  it("does nothing while someone types in a field", () => {
    const { onHelp } = keys();
    const field = screen.getByLabelText("A field");
    fireEvent.keyDown(field, { key: "g" });
    fireEvent.keyDown(field, { key: "o" });
    fireEvent.keyDown(field, { key: "?" });
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
    expect(onHelp).not.toHaveBeenCalled();
  });

  it("G then a letter goes nowhere the person may not open", () => {
    user = { id: "u2", role: "production", department: "production" };
    keys();
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "p" });
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
  });

  it("the list shows only the pages the person may open", () => {
    user = { id: "u2", role: "production", department: "production" };
    render(<MemoryRouter><ShortcutsSheet open onClose={() => {}} /></MemoryRouter>);
    expect(screen.getByText("Job orders")).toBeInTheDocument();
    expect(screen.getByText("Machines")).toBeInTheDocument();
    expect(screen.queryByText("Orders")).not.toBeInTheDocument();
    expect(screen.queryByText("Payroll")).not.toBeInTheDocument();
  });
});

function Arrive({ open }: { open: () => void }) {
  useOpenOnArrival(open);
  return <Where />;
}

describe("opening a form on arrival", () => {
  it("opens once, and the flag leaves the address", () => {
    const open = vi.fn();
    render(
      <MemoryRouter initialEntries={["/orders?new=1&status=Open"]}>
        <Routes><Route path="/orders" element={<Arrive open={open} />} /></Routes>
      </MemoryRouter>
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where")).toHaveTextContent("/orders?status=Open");
  });
});
