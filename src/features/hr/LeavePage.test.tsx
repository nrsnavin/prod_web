import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeavePage, NewLeaveModal, dayLabel, leaveKind, withdrawnMessage } from "./LeavePage";

const createFn = vi.fn().mockResolvedValue({ success: true });
const pendingFn = vi.fn();
const listFn = vi.fn();
const approveFn = vi.fn();
const rejectFn = vi.fn();
const withdrawFn = vi.fn();
const toast = vi.fn();

vi.mock("./api", () => ({
  leaveService: {
    create: (body: unknown) => createFn(body),
    pending: () => pendingFn(),
    list: (query: unknown) => listFn(query),
    approve: (id: string) => approveFn(id),
    reject: (id: string) => rejectFn(id),
    withdraw: (id: string, note?: string) => withdrawFn(id, note),
  },
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/features/employees/hooks", () => ({
  useEmployees: () => ({
    data: [
      { _id: "e1", name: "Ravi Kumar" },
      { _id: "e2", name: "Priya S" },
    ],
    isLoading: false,
  }),
}));

function renderModal(onCreated = vi.fn(), onClose = vi.fn()) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <NewLeaveModal open onClose={onClose} onCreated={onCreated} />
    </QueryClientProvider>
  );
  return { onCreated, onClose };
}

describe("NewLeaveModal (admin create leave)", () => {
  beforeEach(() => {
    createFn.mockClear();
    toast.mockClear();
  });

  it("requires an employee before submitting", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: /create & approve/i }));
    expect(createFn).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/select an employee/i), "error");
  });

  it("creates a leave request for the chosen employee with autoApprove on", async () => {
    const user = userEvent.setup();
    const { onCreated } = renderModal();

    // Combobox trigger is a button showing the placeholder; open it and
    // pick the option.
    await user.click(screen.getByRole("button", { name: /select employee/i }));
    await user.click(await screen.findByRole("option", { name: "Priya S" }));

    await user.type(screen.getByLabelText(/Reason/i), "Family function");
    await user.click(screen.getByRole("button", { name: /create & approve/i }));

    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: "e2",
        leaveType: "casual",
        shift: "BOTH",
        reason: "Family function",
        autoApprove: true,
      })
    );
    expect(onCreated).toHaveBeenCalled();
  });

  it("relabels the action when approve-immediately is unchecked", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.getByRole("button", { name: /create & approve/i })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /^create request$/i })).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════
//  The page itself. Two things it could not do:
//
//    • say whose request it was — it read `employee.name` and `type`,
//      and the server sends `employeeName` and `leaveType`, so every
//      request showed a "?" and asked "approve the request from this
//      worker?";
//    • show, or take back, what had been approved.
//
//  The rows below are as the server sends them (api/leave.js fmtLeave).
// ══════════════════════════════════════════════════════════════════
const waiting = {
  id: "l1", employeeId: "e1", employeeName: "Ravi Kumar", employeeDept: "weaving",
  date: "2026-11-14", dateLabel: "14 Nov 2026", shift: "NIGHT" as const, leaveType: "sick",
  reason: "Fever since Tuesday", status: "pending", createdAt: "2026-11-10T04:00:00.000Z",
};
const granted = {
  id: "l2", employeeId: "e2", employeeName: "Priya S", employeeDept: "packing",
  date: "2026-11-20", dateLabel: "20 Nov 2026", shift: "BOTH" as const, leaveType: "casual",
  reason: "Sister's wedding", status: "approved", createdAt: "2026-11-02T04:00:00.000Z",
};

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LeavePage />
    </QueryClientProvider>
  );
}

describe("LeavePage", () => {
  beforeEach(() => {
    toast.mockClear();
    pendingFn.mockReset().mockResolvedValue([waiting]);
    listFn.mockReset().mockResolvedValue([granted]);
    approveFn.mockReset().mockResolvedValue({ success: true });
    rejectFn.mockReset().mockResolvedValue({ success: true });
    withdrawFn.mockReset().mockResolvedValue({
      success: true, attendance: { removed: 2, unapproved: 0, kept: 0 }, payslipFinal: false, data: granted,
    });
  });

  it("says whose request it is, what for and for which shift", async () => {
    renderPage();
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("Sick · Night shift")).toBeInTheDocument();
    expect(screen.getByText("Fever since Tuesday")).toBeInTheDocument();
    expect(screen.getByText("14 Nov 2026")).toBeInTheDocument();
  });

  it("names the worker when asking to approve", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^approve$/i }));
    expect(screen.getByText(/Approve the leave request from Ravi Kumar\?/)).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^approve$/i }));
    expect(approveFn).toHaveBeenCalledWith("l1");
  });

  it("lists the leave approved from the start of this month", async () => {
    renderPage();
    expect(await screen.findByText("Priya S")).toBeInTheDocument();
    expect(screen.getByText("Casual · Full day")).toBeInTheDocument();
    const [query] = listFn.mock.calls[0];
    expect(query).toMatchObject({ status: "approved" });
    expect(query.from).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("takes an approval back, with the reason given", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /withdraw/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Priya S's leave on 20 Nov 2026 stops being approved/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/why/i), "Coming in after all");
    await user.click(within(dialog).getByRole("button", { name: /withdraw approval/i }));

    expect(withdrawFn).toHaveBeenCalledWith("l2", "Coming in after all");
    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Approval withdrawn — the shift is unmarked again.", "success")
    );
  });

  it("says what a withdrawal did, and when the month was already paid", () => {
    const base = { success: true, data: granted };
    expect(withdrawnMessage({ ...base, attendance: { removed: 0, unapproved: 1, kept: 0 }, payslipFinal: false }))
      .toBe("Approval withdrawn — the shift stays marked on leave, now unapproved.");
    expect(withdrawnMessage({ ...base, attendance: { removed: 0, unapproved: 0, kept: 1 }, payslipFinal: false }))
      .toBe("Approval withdrawn.");
    expect(withdrawnMessage({ ...base, attendance: { removed: 1, unapproved: 0, kept: 0 }, payslipFinal: true }))
      .toMatch(/unmarked again\. That month's payslip is already finalised/);
  });

  it("reads a calendar date as that day, and names a shift in words", () => {
    expect(dayLabel("2026-11-01")).toBe("1 Nov 2026");
    expect(dayLabel("2026-03-31T00:00:00.000Z")).toBe("31 Mar 2026");
    expect(dayLabel(undefined)).toBe("—");
    expect(leaveKind({ id: "x", status: "pending", leaveType: "unpaid", shift: "DAY" })).toBe("Unpaid · Day shift");
    expect(leaveKind({ id: "x", status: "pending" })).toBe("");
  });
});
