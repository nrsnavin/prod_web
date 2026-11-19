import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MachineIssuesPage, closingLine, reportedLine, severityTone } from "./MachineIssuesPage";
import type { MachineIssue } from "./api";

// ══════════════════════════════════════════════════════════════════
//  THE MACHINE ISSUES LIST, AND MOVING AN ISSUE ON
//
//  Found reading the page line by line.
//
//  • A CRITICAL issue wore the chip of a low one. The colours were
//    written for three severities; there are four, and the worst fell
//    through to the mildest.
//  • WHO RAISED IT was shown only when an operator had. An issue raised
//    by the office or from the floor entry read " · 19 Nov 2026".
//  • THE TITLE the reporter typed was shown nowhere.
//  • A CLOSED issue did not say when it was closed, or by whom.
//  • THE BREAKDOWN PATTERN card said "No repeat-offender machines" in
//    green when the check had failed — which it always does for an
//    employee's own login.
//  • MOVING AN ISSUE ON: the notes were sent only if there were some, so
//    notes could not be cleared; and an issue could be resolved or
//    dismissed with no word of why, which the phone does not allow — the
//    operator who reported it reads that note.
// ══════════════════════════════════════════════════════════════════

let listed: MachineIssue[] = [];
let anomaliesFail = false;
let me: { role: string; selfService?: boolean } = { role: "admin" };
const setStatus = vi.fn(async (_id: string, _status: string, _notes?: string) => ({}));
const anomalies = vi.fn(async () => {
  if (anomaliesFail) throw new Error("This is for office staff");
  return { windowDays: 30, threshold: 3, anomalies: [] };
});
const addServiceLog = vi.fn(async (_id: string, _b: unknown) => ({}));

vi.mock("./api", () => ({
  issueService: {
    list: async () => listed,
    anomalies: () => anomalies(),
    setStatus: (id: string, status: string, notes?: string) => setStatus(id, status, notes),
    create: vi.fn(),
    intake: vi.fn(),
  },
}));
vi.mock("@/features/machines/api", () => ({
  machineService: { list: async () => [], addServiceLog: (id: string, b: unknown) => addServiceLog(id, b) },
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: me }) }));

beforeEach(() => {
  listed = [];
  anomaliesFail = false;
  me = { role: "admin" };
  setStatus.mockClear();
  anomalies.mockClear();
  addServiceLog.mockClear();
});

let seq = 0;
const issue = (over: Partial<MachineIssue> = {}): MachineIssue => {
  seq += 1;
  return {
    _id: `i${seq}`, machine: { _id: `m${seq}`, ID: `L-${String(seq).padStart(2, "0")}` },
    employee: { _id: "e1", name: "Ravi", department: "weaving" },
    title: "Belt slipping", description: "Slips under load since morning", severity: "medium", status: "open",
    source: "worker", createdAt: "2026-11-19T04:00:00.000Z", ...over,
  };
};
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><MachineIssuesPage /></MemoryRouter>
    </QueryClientProvider>
  );

describe("how severe", () => {
  it("critical is not painted as the mildest", () => {
    // Before: "info" — the same as low.
    expect(severityTone("critical")).toBe("danger");
    expect(severityTone("high")).toBe("danger");
    expect(severityTone("medium")).toBe("warning");
    expect(severityTone("low")).toBe("info");
  });

  it("shows on the list in red", async () => {
    listed = [issue({ severity: "critical" })];
    renderPage();
    const chip = (await screen.findByText("critical")).closest("span.rounded-full")!;
    expect(chip.className).toContain("text-status-danger");
  });
});

describe("who raised it", () => {
  it("is the operator, the office, or the floor entry", () => {
    expect(reportedLine(issue())).toBe("Reported by Ravi");
    // Before: nothing at all for these two.
    expect(reportedLine(issue({ employee: null, source: "admin", reportedBy: { _id: "u1", name: "Owner" } }))).toBe("Reported by Owner (office)");
    expect(reportedLine(issue({ source: "floor", reportedByName: "Murugan" }))).toBe("Raised at the floor entry by Murugan");
    expect(reportedLine(issue({ source: "floor", reportedByName: "" }))).toBe("Raised at the floor entry");
  });

  it("says nothing when nobody is known, and leaves no stray dot", async () => {
    expect(reportedLine(issue({ employee: null, source: "admin", reportedBy: "u1" }))).toBe("");
    listed = [issue({ employee: null, source: "admin", reportedBy: "u1" })];
    renderPage();
    // Before: " · 19 Nov 2026".
    expect(await screen.findByText("19 Nov 2026")).toBeInTheDocument();
  });

  it("is on the list, with the title the reporter gave", async () => {
    listed = [issue({ employee: null, source: "admin", reportedBy: { _id: "u1", name: "Owner" } })];
    renderPage();
    expect(await screen.findByText("Reported by Owner (office) · 19 Nov 2026")).toBeInTheDocument();
    // Before: the title was shown nowhere.
    expect(screen.getByText("Belt slipping")).toBeInTheDocument();
    expect(screen.getByText("Slips under load since morning")).toBeInTheDocument();
  });
});

describe("a closed issue", () => {
  it("says when it was closed, and by whom", async () => {
    const done = issue({ status: "resolved", resolutionNotes: "Belt replaced", resolvedAt: "2026-11-10T06:30:00.000Z", resolvedBy: { _id: "u1", name: "Owner" } });
    expect(closingLine(done)).toBe("Resolved 10 Nov 2026 by Owner");
    expect(closingLine({ ...done, status: "rejected" })).toBe("Dismissed 10 Nov 2026 by Owner");
    expect(closingLine({ ...done, resolvedBy: "u1" })).toBe("Resolved 10 Nov 2026");
    expect(closingLine(issue({ status: "in_progress" }))).toBe("");

    listed = [done];
    renderPage();
    // Before: only the note.
    expect(await screen.findByText("Resolved 10 Nov 2026 by Owner")).toBeInTheDocument();
  });
});

describe("the breakdown pattern", () => {
  it("is not an all-clear when the check failed", async () => {
    anomaliesFail = true;
    listed = [issue()];
    renderPage();
    expect(await screen.findByText(/Could not check for machines that keep breaking down/)).toBeInTheDocument();
    // Before: "No repeat-offender machines (3+ in 30d)", in green.
    expect(screen.queryByText(/No repeat-offender machines/)).not.toBeInTheDocument();
  });

  it("is not asked for by an employee's own login, which may not see it", async () => {
    me = { role: "production", selfService: true };
    listed = [issue()];
    renderPage();
    await screen.findByText("Belt slipping");
    expect(anomalies).not.toHaveBeenCalled();
    expect(screen.queryByText(/repeat-offender/)).not.toBeInTheDocument();
  });

  it("says so when there is none (unchanged)", async () => {
    renderPage();
    expect(await screen.findByText(/No repeat-offender machines \(3\+ in 30d\)/)).toBeInTheDocument();
  });
});

describe("moving an issue on", () => {
  const open = async (i: MachineIssue) => {
    listed = [i];
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Update" }));
    return within(await screen.findByRole("dialog"));
  };
  const save = (form: ReturnType<typeof within>) => form.getByRole("button", { name: "Update issue" });

  it("says nothing of the notes when they were not touched", async () => {
    const i = issue({ status: "acknowledged", resolutionNotes: "Ordered the belt" });
    const form = await open(i);
    await userEvent.selectOptions(form.getByLabelText("Status"), "in_progress");
    await userEvent.click(save(form));
    // The server keeps what it has — a colleague's later note included.
    expect(setStatus).toHaveBeenCalledWith(i._id, "in_progress", undefined);
  });

  it("sends notes that were typed", async () => {
    const i = issue({ status: "acknowledged" });
    const form = await open(i);
    await userEvent.type(form.getByLabelText(/Resolution notes/), "Ordered the belt, due Friday");
    await userEvent.click(save(form));
    expect(setStatus).toHaveBeenCalledWith(i._id, "acknowledged", "Ordered the belt, due Friday");
  });

  it("sends notes that were cleared, as cleared", async () => {
    const i = issue({ status: "acknowledged", resolutionNotes: "Ordered the belt" });
    const form = await open(i);
    await userEvent.clear(form.getByLabelText(/Resolution notes/));
    await userEvent.click(save(form));
    // Before: nothing was sent, so the note could never be removed.
    expect(setStatus).toHaveBeenCalledWith(i._id, "acknowledged", "");
  });

  it("does not close an issue without a word of why", async () => {
    const i = issue({ status: "in_progress" });
    const form = await open(i);
    await userEvent.selectOptions(form.getByLabelText("Status"), "rejected");
    // Before: dismissed with nothing for the operator to read.
    expect(save(form)).toBeDisabled();
    expect(form.getByText(/Say why/)).toBeInTheDocument();

    await userEvent.type(form.getByLabelText(/Resolution notes/), "Not a fault: wrong tension setting");
    expect(save(form)).toBeEnabled();
    await userEvent.click(save(form));
    expect(setStatus).toHaveBeenCalledWith(i._id, "rejected", "Not a fault: wrong tension setting");
  });

  it("takes the work done as the note when only the service log was filled", async () => {
    const i = issue({ status: "in_progress" });
    const form = await open(i);
    await userEvent.selectOptions(form.getByLabelText("Status"), "resolved");
    expect(save(form)).toBeDisabled();
    expect(form.getByText(/Say what was done/)).toBeInTheDocument();

    await userEvent.type(form.getByLabelText("Work done"), "Replaced drive belt");
    expect(save(form)).toBeEnabled();
    await userEvent.click(save(form));
    expect(setStatus).toHaveBeenCalledWith(i._id, "resolved", "Replaced drive belt");
    expect(addServiceLog).toHaveBeenCalledWith(i.machine!._id, expect.objectContaining({ description: "Replaced drive belt" }));
  });

  it("an open status needs no note (unchanged)", async () => {
    const i = issue({ status: "open" });
    const form = await open(i);
    await userEvent.selectOptions(form.getByLabelText("Status"), "acknowledged");
    expect(save(form)).toBeEnabled();
    await userEvent.click(save(form));
    expect(setStatus).toHaveBeenCalledWith(i._id, "acknowledged", undefined);
  });
});
