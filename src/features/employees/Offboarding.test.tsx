import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/core/http/httpClient";
import { OffboardDialog } from "./OffboardDialog";
import { EmployeeDetailPage } from "./EmployeeDetailPage";
import { EmployeeListPage } from "./EmployeeListPage";
import type { Employee, EmployeeDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  OFFBOARDING — someone leaves
//
//  Held here: the admin records the last working day and why; a shift
//  after that day is named when the server refuses; a manager login
//  left working is pointed out; the page says they have left and offers
//  Reinstate instead of Offboard; the list can show who has left.
// ══════════════════════════════════════════════════════════════════

const offboard = vi.fn();
const reinstate = vi.fn();
const getById = vi.fn();
const list = vi.fn();
vi.mock("./api", () => ({
  employeeService: {
    offboard: (id: string, body: unknown) => offboard(id, body),
    reinstate: (id: string, note?: string) => reinstate(id, note),
    getById: (id: string) => getById(id),
    list: (dept: string, status?: string) => list(dept, status),
  },
}));
// The page's other cards fetch their own data; they are not what is tested here.
vi.mock("./EmployeePayrollCard", () => ({ EmployeePayrollCard: () => null }));
vi.mock("./EmployeeLeavePayCard", () => ({ EmployeeLeavePayCard: () => null }));
vi.mock("./EmployeeAttendanceCard", () => ({ EmployeeAttendanceCard: () => null }));
vi.mock("./EmployeeBonusCard", () => ({ EmployeeBonusCard: () => null }));
vi.mock("./SkillProfileCard", () => ({ SkillProfileCard: () => null }));
vi.mock("./WorkerAccessCard", () => ({ WorkerAccessCard: () => <p>App access card</p> }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
let user: { role: string; department: string; features?: string[] } = { role: "admin", department: "admin" };
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));

function wrap(ui: React.ReactNode, path = "/") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/employees/:id" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const detail = (over: Partial<EmployeeDetail> = {}): EmployeeDetail => ({
  id: "e1", name: "Ravi", department: "weaving", role: "operator", phoneNumber: "9100000001",
  status: "active", offboarding: null, pastOffboardings: [], totalShifts: 4, result: [], ...over,
});

beforeEach(() => {
  offboard.mockReset();
  reinstate.mockReset();
  getById.mockReset();
  list.mockReset();
  toast.mockReset();
  user = { role: "admin", department: "admin" };
});

describe("the offboard dialog", () => {
  const open = () => wrap(<OffboardDialog empId="e1" name="Ravi" onClose={() => {}} />);

  it("asks why before sending", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "Offboard" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose why they are leaving.");
    expect(offboard).not.toHaveBeenCalled();
  });

  it("records the day, the reason and a note, and says what happened to their sign-in", async () => {
    offboard.mockResolvedValue({
      success: true, workerLoginClosed: true, managerLogin: { id: "u9", email: "ravi@balu.in" },
      employee: { id: "e1", name: "Ravi", status: "offboarded", lastWorkingDay: "2026-10-25T00:00:00.000Z", reason: "resigned" },
    });
    open();
    const day = screen.getByLabelText("Last working day");
    await userEvent.clear(day);
    await userEvent.type(day, "2026-10-25");
    await userEvent.selectOptions(screen.getByLabelText("Reason"), "resigned");
    await userEvent.type(screen.getByLabelText("Note (optional)"), "Moved to Tiruppur");
    await userEvent.click(screen.getByRole("button", { name: "Offboard" }));

    expect(offboard).toHaveBeenCalledWith("e1", { lastWorkingDay: "2026-10-25", reason: "resigned", note: "Moved to Tiruppur" });
    expect(await screen.findByText(/recorded as leaving after 25 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/phone sign-in is turned off/)).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("They still have a manager login (ravi@balu.in), and it still works.");
    expect(within(alert).getByRole("link", { name: /remove it under users/i })).toHaveAttribute("href", "/users");
    expect(toast).toHaveBeenCalledWith("Ravi offboarded", "success");
  });

  it("names the shifts that keep them from leaving that day", async () => {
    offboard.mockRejectedValue(new ApiError("Ravi is on 1 shift after 25 Oct 2026. Put someone else on it first, or pick a later last working day.", 409, undefined,
      "EMPLOYEE_HAS_LATER_SHIFTS", { details: { shifts: [{ id: "s1", date: "2026-10-27T00:00:00.000Z", shift: "DAY", status: "open", machine: "L-7" }] } }));
    open();
    await userEvent.selectOptions(screen.getByLabelText("Reason"), "absconded");
    await userEvent.click(screen.getByRole("button", { name: "Offboard" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Ravi is on 1 shift after/);
    expect(within(alert).getByText("27 Oct 2026 · Day · L-7")).toBeInTheDocument();
  });
});

describe("the employee page", () => {
  it("offers Offboard to an admin, and only to an admin", async () => {
    getById.mockResolvedValue(detail());
    const { unmount } = wrap(<EmployeeDetailPage />, "/employees/e1");
    await userEvent.click(await screen.findByRole("button", { name: /offboard/i }));
    expect(await screen.findByRole("dialog", { name: "Offboard Ravi" })).toBeInTheDocument();
    unmount();

    user = { role: "production", department: "production", features: ["/employees"] };
    wrap(<EmployeeDetailPage />, "/employees/e1");
    await screen.findByText("Total shifts");
    expect(screen.queryByRole("button", { name: /offboard/i })).not.toBeInTheDocument();
  });

  it("says they have left, why, and offers Reinstate — no sign-in to give", async () => {
    getById.mockResolvedValue(detail({
      status: "offboarded",
      offboarding: { lastWorkingDay: "2026-10-01T00:00:00.000Z", reason: "resigned", note: "Moved to Tiruppur", recordedByName: "Owner", recordedAt: "2026-10-02T00:00:00.000Z" },
      pastOffboardings: [{ lastWorkingDay: "2025-03-31T00:00:00.000Z", reason: "contract_ended", reinstatedAt: "2025-06-01T00:00:00.000Z" }],
    }));
    reinstate.mockResolvedValue({ success: true });
    wrap(<EmployeeDetailPage />, "/employees/e1");

    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Left — last working day 1 Oct 2026 · Resigned");
    expect(banner).toHaveTextContent("Moved to Tiruppur");
    expect(banner).toHaveTextContent("Recorded by Owner on 2 Oct 2026");
    expect(screen.queryByText("App access card")).not.toBeInTheDocument();
    expect(screen.getByText(/Left 31 Mar 2025 \(Contract ended\), reinstated 1 Jun 2025/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /offboard/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reinstate/i }));
    const dialog = await screen.findByRole("dialog", { name: "Reinstate Ravi" });
    await userEvent.type(within(dialog).getByRole("textbox"), "Rejoined on 1 Nov");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reinstate" }));
    expect(reinstate).toHaveBeenCalledWith("e1", "Rejoined on 1 Nov");
    expect(toast).toHaveBeenCalledWith("Ravi reinstated", "success");
  });
});

describe("the employee list", () => {
  it("shows who is working by default, and who has left on asking", async () => {
    const row = (over: Partial<Employee>): Employee => ({ _id: "e1", name: "Ravi", department: "weaving", ...over });
    list.mockImplementation(async (_d: string, status?: string) =>
      status === "left"
        ? [row({ status: "offboarded", offboarding: { lastWorkingDay: "2026-10-01T00:00:00.000Z", reason: "resigned" } })]
        : [row({ _id: "e2", name: "Kumar" })]);
    wrap(<EmployeeListPage />);
    expect(await screen.findAllByText("Kumar")).not.toHaveLength(0);
    expect(list).toHaveBeenLastCalledWith("all", "active");

    await userEvent.click(screen.getByRole("button", { name: "Left" }));
    expect((await screen.findAllByText("Left 1 Oct 2026")).length).toBeGreaterThan(0);
    expect(list).toHaveBeenLastCalledWith("all", "left");
  });
});
