import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ══════════════════════════════════════════════════════════════════
//  WASTAGE: WHO ENTERED IT, AND AN EDIT THAT THE SERVER WILL TAKE
//
//  A wastage entry's penalty comes out of the employee's pay. The server
//  now keeps who entered each record (prod: tests/api/wastageRules.test.js);
//  the page shows it. And the edit form holds itself to what the server
//  accepts — a cause that is not blank, a penalty that is not negative —
//  and says so in its own words: the server's "reason" could be taken for
//  the "reason for edit" box beside it.
//
//  Only the HTTP transport is mocked: the real api, hooks and page run.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
const put = vi.fn();

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return {
    ...actual,
    httpClient: {
      get: (...a: unknown[]) => get(...a),
      put: (...a: unknown[]) => put(...a),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      getBlob: vi.fn(),
    },
  };
});

const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

import { WastagePage } from "./WastagePage";

const RECORDS = [
  {
    _id: "w1", elastic: { _id: "e1", name: "20mm Black" }, employee: { _id: "emp1", name: "Operator Ravi" },
    quantity: 40, penalty: 100, reason: "Selvedge torn", createdAt: "2026-11-18T06:00:00.000Z", recordedByName: "Selvi",
  },
  {
    // Entered before the server kept it.
    _id: "w2", elastic: { _id: "e1", name: "20mm Black" }, employee: { _id: "emp2", name: "Operator Mani" },
    quantity: 12, penalty: 0, reason: "Beam change", createdAt: "2026-10-02T06:00:00.000Z",
  },
];

function serve() {
  get.mockImplementation(async (url: string) => {
    if (url === "/wastage/jobs-wastage-list") {
      return { success: true, jobs: [{ _id: "j1", jobOrderNo: 41, status: "weaving", customer: { name: "Acme" }, totalWastage: 52, wastageCount: 2 }] };
    }
    if (url === "/wastage/get-by-job") return { success: true, wastages: RECORDS };
    if (url === "/wastage/analytics") {
      return { success: true, analytics: { topEmployees: [], byElastic: [], byStatus: [], trend: [], totalWastage: 0, totalPenalty: 0, totalCount: 0, days: 30 } };
    }
    if (url === "/wastage/root-cause") {
      return { success: true, days: 30, totals: { qty: 0, count: 0, penalty: 0 }, byReason: [], byOperator: [], byElastic: [], byMachine: [], reasonMachine: [], reasonOperator: [], insights: [], aiSummary: null, aiGenerated: false };
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <WastagePage />
    </QueryClientProvider>
  );
}

async function openJob() {
  const user = userEvent.setup();
  show();
  await user.click(await screen.findByText("J-41"));
  await screen.findByText(/Selvedge torn/);
  return user;
}

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  toast.mockReset();
  serve();
});

describe("a wastage record on the page", () => {
  it("says who entered it, and says nothing for a record that never kept it", async () => {
    await openJob();
    expect(screen.getByText(/Operator Ravi · Selvedge torn/).textContent).toMatch(/entered by Selvi/);
    expect(screen.getByText(/Operator Mani · Beam change/).textContent).not.toMatch(/entered by/);
  });
});

describe("editing a wastage record", () => {
  async function openEdit() {
    const user = await openJob();
    await user.click(screen.getAllByRole("button", { name: "Edit wastage" })[0]);
    await user.type(await screen.findByLabelText("Reason for this change"), "measured again");
    return user;
  }

  it("does not send a blank cause: it says what is missing", async () => {
    const user = await openEdit();
    await user.clear(screen.getByLabelText("Reason (cause)"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(toast).toHaveBeenCalledWith("Say what caused the wastage", "error");
    expect(put).not.toHaveBeenCalled();
  });

  it("does not send a negative penalty", async () => {
    const user = await openEdit();
    const penalty = screen.getByLabelText("Penalty (₹)");
    await user.clear(penalty);
    await user.type(penalty, "-50");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(toast).toHaveBeenCalledWith("A penalty cannot be less than ₹0", "error");
    expect(put).not.toHaveBeenCalled();
  });

  it("sends a good edit with the cause trimmed", async () => {
    put.mockResolvedValue({ success: true });
    const user = await openEdit();
    const cause = screen.getByLabelText("Reason (cause)");
    await user.clear(cause);
    await user.type(cause, "  Selvedge torn at the temple  ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put).toHaveBeenCalledWith("/wastage/w1", {
      quantity: 40, penalty: 100, reason: "Selvedge torn at the temple", auditReason: "measured again",
    });
  });
});
