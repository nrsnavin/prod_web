import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/core/http/httpClient";
import { FloorPage } from "./FloorPage";
import type { EntrySaved, FloorMachine, FloorPlan, FloorState } from "./types";

// ══════════════════════════════════════════════════════════════════
//  The floor screen, end to end against a stubbed server: open with
//  the PIN, scan or pick a loom, say who ran it (which puts it on the
//  shift, making the plan when there is none), enter its production,
//  and get the PIN asked for again when the session ends — without
//  losing the place.
// ══════════════════════════════════════════════════════════════════

const svc = {
  open: vi.fn(),
  shift: vi.fn(),
  machine: vi.fn(),
  setOperator: vi.fn(),
  enter: vi.fn(),
  readTimerPhoto: vi.fn(),
  photoUsed: vi.fn(),
};
let stored: { token: string; session: { dateKey: string; shift: "DAY" | "NIGHT"; name: string } } | null = null;
vi.mock("./floorClient", () => ({
  floorService: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (svc as Record<string, (...x: unknown[]) => unknown>)[k](...a) }),
  floorTokenStore: {
    read: () => stored,
    write: (token: string, session: { dateKey: string; shift: "DAY" | "NIGHT"; name: string }) => { stored = { token, session }; },
    clear: () => { stored = null; },
  },
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const loom = (over: Partial<FloorMachine> & { ID: string }): FloorMachine => ({
  id: `id-${over.ID}`, manufacturer: "Comez", hooks: 8, heads: 4, headsRunning: 2, status: "running", loading: false,
  job: { id: "j1", no: "J-12", status: "weaving" },
  headMap: [{ head: 0, elastic: { id: "e1", name: "20mm White" } }, { head: 1, elastic: { id: "e1", name: "20mm White" } }, { head: 2, elastic: null }],
  detail: null, entry: "unplanned", why: null,
  ...over,
});
const stateOf = (machines: FloorMachine[], plan: FloorState["plan"] = null, extra: Partial<FloorState> = {}): FloorState => {
  const counts = machines.reduce((c, m) => ({ ...c, [m.entry]: (c[m.entry] ?? 0) + 1 }), {} as Record<string, number>);
  return {
    dateKey: "2026-10-21", shift: "DAY", label: "Day shift · 21 Oct 2026", isCurrent: true, plan, machines,
    operators: [{ id: "o1", name: "Ravi", department: "weaving" }, { id: "o2", name: "Sita", department: "weaving" }],
    counts: { total: machines.length, toEnter: (counts.ready ?? 0) + (counts.unplanned ?? 0), entered: (counts.entered ?? 0) + (counts.verified ?? 0), ...counts },
    ...extra,
  };
};
const session = { dateKey: "2026-10-21", shift: "DAY" as const, name: "Kumar" };
const planned: FloorPlan = { id: "p1", status: "confirmed", finalized: false, description: "", fromFloor: false, floor: null };
const fromFloor: FloorPlan = { ...planned, status: "draft", fromFloor: true };
const saved = (machine: FloorMachine, plan: FloorPlan = planned, shiftComplete: EntrySaved["shiftComplete"] = null): EntrySaved => ({ machine, plan, shiftComplete });

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
  toast.mockReset();
  stored = null;
  localStorage.clear();
});

const openWith = async (pin = "4821") => {
  await userEvent.type(screen.getByLabelText("Your name"), "Kumar");
  await userEvent.type(screen.getByLabelText("Shift PIN"), pin);
  await userEvent.click(screen.getByRole("button", { name: /open shift/i }));
};

describe("opening the shift", () => {
  it("asks for the date, shift, name and PIN, and goes straight to scanning — saying so when there is no plan", async () => {
    svc.open.mockResolvedValue({ token: "t", session, state: stateOf([loom({ ID: "L1" }), loom({ ID: "L2", status: "free", job: null, entry: "free" })]) });
    render(<FloorPage />);
    expect(screen.getByRole("heading", { name: /open the shift/i })).toBeInTheDocument();
    await openWith();

    expect(svc.open).toHaveBeenCalledWith(expect.objectContaining({ pin: "4821", name: "Kumar", shift: expect.stringMatching(/DAY|NIGHT/) }));
    expect(await screen.findByText(/0 of 1 entered/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/No plan for this shift yet/);
    expect(screen.getByRole("button", { name: /L1/ })).toBeInTheDocument();
    expect(screen.getByText("Kumar")).toBeInTheDocument();
  });

  it("shows the server's words for a wrong PIN and clears the field", async () => {
    svc.open.mockRejectedValue(new ApiError("That is not the PIN for the day shift of 21 Oct 2026.", 401));
    render(<FloorPage />);
    await openWith("0000");
    expect(await screen.findByRole("alert")).toHaveTextContent(/not the PIN/);
    expect(screen.getByLabelText("Shift PIN")).toHaveValue("");
  });

  it("goes straight to scanning when the plan exists, and says when the shift is not the one running", async () => {
    svc.open.mockResolvedValue({ token: "t", session, state: stateOf([loom({ ID: "L1", entry: "ready", detail: { id: "d1", status: "open", operator: { id: "o1", name: "Ravi" }, submitted: null } })], planned, { isCurrent: false }) });
    render(<FloorPage />);
    await openWith();
    expect(await screen.findByText(/0 of 1 entered/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/not the shift running now/);
  });

  it("carries on from a kept token after a reload", async () => {
    stored = { token: "t", session };
    svc.shift.mockResolvedValue(stateOf([loom({ ID: "L1", entry: "ready", detail: { id: "d1", status: "open", operator: null, submitted: null } })], planned));
    render(<FloorPage />);
    expect(await screen.findByText(/0 of 1 entered/)).toBeInTheDocument();
    expect(svc.open).not.toHaveBeenCalled();
  });
});

describe("the plan, made from the floor", () => {
  it("is made the moment the first loom's operator is chosen, and the timer photo is kept with that entry", async () => {
    const unplanned = loom({ ID: "L1" });
    svc.open.mockResolvedValue({ token: "t", session, state: stateOf([unplanned]) });
    svc.shift.mockResolvedValue(stateOf([unplanned]));
    svc.setOperator.mockResolvedValue({ detailId: "d1", added: true, planCreated: true });
    render(<FloorPage />);
    await openWith();
    await userEvent.click(await screen.findByRole("button", { name: /L1/ }));

    await userEvent.selectOptions(await screen.findByLabelText(/operator — puts this loom on the shift/i), "o1");
    await waitFor(() => expect(svc.setOperator).toHaveBeenCalledWith("id-L1", "o1"));
    expect(await screen.findByLabelText("Operator")).toHaveValue("o1");
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Shift plan made from this loom/), "info");

    // The photo taken next goes with the entry just made.
    svc.readTimerPhoto.mockResolvedValue({ reading: { displays: [], primary: { text: "7:30:00", kind: "run_time" }, problem: null }, suggestionId: null, photoId: "ph1" });
    const file = new File([new Uint8Array([1, 2, 3])], "timer.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByTestId("timer-photo-input"), file);
    await waitFor(() => expect(svc.readTimerPhoto).toHaveBeenCalledWith(expect.anything(), "d1"));

    svc.enter.mockResolvedValue(saved({ ...unplanned, entry: "entered", detail: { id: "d1", status: "pending_verification", operator: { id: "o1", name: "Ravi" }, submitted: { production: 500, timer: null, feedback: "", at: null, byName: "Kumar" } } }, fromFloor));
    await userEvent.type(screen.getByLabelText(/production per head/i), "500");
    await userEvent.click(screen.getByRole("button", { name: /save and scan next/i }));
    await waitFor(() => expect(svc.enter).toHaveBeenCalledWith(expect.objectContaining({ detailId: "d1", production: 500, operator: "o1" })));
    expect(svc.setOperator).toHaveBeenCalledTimes(1);
  });

  it("shows the server's words when the loom cannot go on the shift, and clears the choice", async () => {
    const unplanned = loom({ ID: "L1" });
    svc.open.mockResolvedValue({ token: "t", session, state: stateOf([unplanned]) });
    svc.shift.mockResolvedValue(stateOf([unplanned]));
    svc.setOperator.mockRejectedValue(new ApiError("Ravi left on 20 Oct 2026 — choose someone else for this shift.", 409, undefined, "EMPLOYEE_OFFBOARDED"));
    render(<FloorPage />);
    await openWith();
    await userEvent.click(await screen.findByRole("button", { name: /L1/ }));
    await userEvent.selectOptions(await screen.findByLabelText(/operator — puts this loom on the shift/i), "o1");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Ravi left on 20 Oct 2026/);
    expect(screen.getByLabelText(/operator — puts this loom on the shift/i)).toHaveValue("");
  });
});

describe("scanning and entering", () => {
  const ready = loom({ ID: "L1", entry: "ready", detail: { id: "d1", status: "open", operator: { id: "o1", name: "Ravi" }, submitted: null } });
  const start = async (machines = [ready], plan = planned) => {
    svc.open.mockResolvedValue({ token: "t", session, state: stateOf(machines, plan) });
    svc.shift.mockResolvedValue(stateOf(machines, plan));
    render(<FloorPage />);
    await openWith();
    await screen.findByText(/entered$/);
  };

  it("finds a typed machine ID, shows the loom with its job and head map, and saves the entry", async () => {
    await start();
    svc.machine.mockResolvedValue(ready);
    const entered = { ...ready, entry: "entered" as const, detail: { ...ready.detail!, status: "pending_verification", submitted: { production: 820, timer: "7:30:00", feedback: "", at: "2026-10-21T10:00:00Z", byName: "Kumar" } } };
    svc.enter.mockResolvedValue(saved(entered));

    await userEvent.type(screen.getByLabelText(/type the machine ID/i), "l1");
    await userEvent.click(screen.getByRole("button", { name: /find/i }));
    expect(svc.machine).toHaveBeenCalledWith("l1");

    const card = await screen.findByRole("region", { name: "Loom" });
    expect(within(card).getByRole("heading", { name: "L1" })).toBeInTheDocument();
    expect(within(card).getByText(/J-12 · weaving/)).toBeInTheDocument();
    expect(within(card).getByText("2 of 4")).toBeInTheDocument();
    expect(within(card).getAllByText("20mm White")).toHaveLength(2);
    expect(within(card).getByText("free")).toBeInTheDocument();
    expect(screen.getByLabelText("Operator")).toHaveValue("o1");

    await userEvent.type(screen.getByLabelText("Run time"), "7.30");
    await userEvent.type(screen.getByLabelText(/production per head/i), "820");
    expect(screen.getByText(/× 2 heads running = 1,640 m/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Remarks"), "beam change");
    // The shift as the server has it after the save, for the refresh.
    svc.shift.mockResolvedValue(stateOf([entered], planned));
    await userEvent.click(screen.getByRole("button", { name: /save and scan next/i }));

    expect(svc.enter).toHaveBeenCalledWith({ detailId: "d1", production: 820, timer: "7:30:00", feedback: "beam change", operator: "o1" });
    expect(await screen.findByText(/1 of 1 entered/)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/L1 saved — 820 m\/head/), "success");
    expect(screen.getByText(/every loom on this shift is entered/i)).toBeInTheDocument();
  });

  it("fills the metres a head from the run time at 30 cm a minute, and leaves a typed figure alone", async () => {
    await start();
    svc.machine.mockResolvedValue(ready);
    await userEvent.type(screen.getByLabelText(/type the machine ID/i), "L1");
    await userEvent.click(screen.getByRole("button", { name: /find/i }));
    const metres = await screen.findByLabelText(/production per head/i);

    await userEvent.type(screen.getByLabelText("Run time"), "7:30");
    expect(metres).toHaveValue(135);
    expect(screen.getByText(/filled from the run time at 30 cm\/min/i)).toBeInTheDocument();
    expect(screen.getByText(/× 2 heads running = 270 m/)).toBeInTheDocument();

    // A longer run time refills it, since nobody has typed over it.
    await userEvent.clear(screen.getByLabelText("Run time"));
    await userEvent.type(screen.getByLabelText("Run time"), "8:00");
    expect(metres).toHaveValue(144);

    // Typed over: the figure is the supervisor's now, whatever the run time does.
    await userEvent.clear(metres);
    await userEvent.type(metres, "150");
    await userEvent.clear(screen.getByLabelText("Run time"));
    await userEvent.type(screen.getByLabelText("Run time"), "9:00");
    expect(metres).toHaveValue(150);
    expect(screen.queryByText(/filled from the run time/i)).not.toBeInTheDocument();
  });

  it("refuses a job label before asking the server, and shows the server's words for an unknown one", async () => {
    await start();
    await userEvent.type(screen.getByLabelText(/type the machine ID/i), "J-12");
    await userEvent.click(screen.getByRole("button", { name: /find/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/job label/);
    expect(svc.machine).not.toHaveBeenCalled();

    svc.machine.mockRejectedValue(new ApiError('No machine called "L9". Check the label, or pick the loom from the list.', 404));
    await userEvent.clear(screen.getByLabelText(/type the machine ID/i));
    await userEvent.type(screen.getByLabelText(/type the machine ID/i), "L9");
    await userEvent.click(screen.getByRole("button", { name: /find/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No machine called "L9"/);
  });

  it("adds a loom the plan left out as soon as its operator is chosen", async () => {
    const unplanned = loom({ ID: "L7" });
    await start([ready, unplanned]);
    svc.setOperator.mockResolvedValue({ detailId: "d7", added: true, planCreated: false });
    svc.enter.mockResolvedValue(saved({ ...unplanned, entry: "entered" }));

    await userEvent.click(screen.getByRole("button", { name: /L7/ }));
    expect(await screen.findByLabelText(/operator — puts this loom on the shift/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/production per head/i), "500");
    await userEvent.click(screen.getByRole("button", { name: /save and scan next/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/choose who ran this loom/i);
    expect(svc.enter).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText(/operator — puts this loom on the shift/i), "o2");
    await waitFor(() => expect(svc.setOperator).toHaveBeenCalledWith("id-L7", "o2"));
    expect(await screen.findByLabelText("Operator")).toHaveValue("o2");
    expect(toast).not.toHaveBeenCalledWith(expect.stringMatching(/plan made/i), expect.anything());
    await userEvent.click(screen.getByRole("button", { name: /save and scan next/i }));
    await waitFor(() => expect(svc.enter).toHaveBeenCalled());
    expect(svc.enter).toHaveBeenCalledWith(expect.objectContaining({ detailId: "d7", production: 500, operator: "o2" }));
  });

  it("shows what was entered and lets it be corrected until verified", async () => {
    const entered = loom({ ID: "L1", entry: "entered", detail: { id: "d1", status: "pending_verification", operator: { id: "o1", name: "Ravi" }, submitted: { production: 820, timer: "7:30:00", feedback: "beam", at: "2026-10-21T04:30:00Z", byName: "Kumar" } } });
    await start([entered]);
    await userEvent.click(screen.getByRole("button", { name: /L1/ }));
    expect(await screen.findByText(/Entered: 820 m\/head · 7:30:00 by Kumar/)).toBeInTheDocument();
    expect(screen.getByLabelText(/production per head/i)).toHaveValue(820);
    expect(screen.getByLabelText("Run time")).toHaveValue("7:30:00");
    expect(screen.getByRole("button", { name: /save the correction/i })).toBeInTheDocument();
  });

  it("explains a loom that cannot be entered — verified, loading, free, locked — and offers the next one", async () => {
    const cases: [FloorMachine, RegExp][] = [
      [loom({ ID: "L1", entry: "verified", why: "Verified already.", detail: { id: "d1", status: "closed", operator: null, submitted: { production: 800, timer: "7:00:00", feedback: "", at: null, byName: "" } } }), /Verified already/],
      [loom({ ID: "L2", entry: "loading", loading: true, why: "The loom is being loaded for its job — nothing to enter." }), /being loaded/],
      [loom({ ID: "L3", entry: "free", status: "free", job: null, why: "No job on this loom." }), /No job on this loom/],
      [loom({ ID: "L4", entry: "locked", why: "Its job is finishing; production is closed.", job: { id: "j", no: "J-3", status: "finishing" } }), /production is closed/],
    ];
    await start(cases.map(([m]) => m));
    for (const [m, words] of cases) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${m.ID}(?!\\d)`) }));
      expect(await screen.findByText(words)).toBeInTheDocument();
      expect(screen.queryByLabelText(/production per head/i)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /scan the next loom/i }));
      await screen.findByText(/entered$/);
    }
  });

  it("shows the office's operator on a loom it planned, and does not let the floor change it", async () => {
    const office = loom({ ID: "L1", entry: "ready", detail: { id: "d1", status: "open", operator: { id: "o1", name: "Ravi" }, operatorLocked: true, submitted: null } });
    await start([office]);
    svc.enter.mockResolvedValue(saved({ ...office, entry: "entered" }));
    await userEvent.click(screen.getByRole("button", { name: /L1/ }));
    const operator = await screen.findByLabelText("Operator");
    expect(operator).toHaveTextContent("Ravi");
    expect(operator).toHaveTextContent(/by the office/);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/production per head/i), "400");
    await userEvent.click(screen.getByRole("button", { name: /save and scan next/i }));
    await waitFor(() => expect(svc.enter).toHaveBeenCalledWith(expect.objectContaining({ detailId: "d1", production: 400, operator: null })));
    expect(svc.setOperator).not.toHaveBeenCalled();
  });

  it("says when the last running loom is entered: the plan is drafted and the free looms are named", async () => {
    const mine = loom({ ID: "L1", entry: "ready", detail: { id: "d1", status: "open", operator: { id: "o1", name: "Ravi" }, operatorLocked: false, submitted: null } });
    await start([mine, loom({ ID: "L2", status: "free", job: null, entry: "free", why: "No job on this loom." })], fromFloor);
    const done = { ...mine, entry: "entered" as const };
    const completion = { completedAt: "2026-10-21T14:00:00Z", completedBy: "Kumar", freeMachines: [{ id: "id-L2", ID: "L2", why: "No job on this loom." }] };
    svc.enter.mockResolvedValue(saved(done, { ...fromFloor, floor: completion }, { ...completion, entered: 1 }));

    await userEvent.click(screen.getByRole("button", { name: /^L1/ }));
    await userEvent.type(await screen.findByLabelText(/production per head/i), "600");
    // The shift as the server has it after the save, for the refresh.
    svc.shift.mockResolvedValue(stateOf([done, loom({ ID: "L2", status: "free", job: null, entry: "free" })], { ...fromFloor, floor: completion }));
    await userEvent.click(screen.getByRole("button", { name: /save and scan next/i }));

    expect(await screen.findByText(/Every running loom is entered — the shift plan is drafted for the office to confirm/)).toBeInTheDocument();
    expect(screen.getByText(/1 loom was free: L2\./)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith("Every loom entered — plan drafted for the office. 1 loom free: L2.", "info");
  });

  it("locks everything when the shift is finalised", async () => {
    await start([ready], { ...planned, finalized: true });
    expect(screen.getByRole("status")).toHaveTextContent(/finalised/);
    await userEvent.click(screen.getByRole("button", { name: /L1/ }));
    expect(await screen.findByText("This shift is finalised.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/production per head/i)).not.toBeInTheDocument();
  });

  it("asks for the PIN again when the session ends, keeping the place", async () => {
    await start();
    svc.machine.mockRejectedValue(new ApiError("The shift PIN was changed. Enter the new PIN to carry on.", 401));
    await userEvent.type(screen.getByLabelText(/type the machine ID/i), "L1");
    await userEvent.click(screen.getByRole("button", { name: /find/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/enter the PIN again/i)).toBeInTheDocument();
    svc.open.mockResolvedValue({ token: "t2", session, state: stateOf([ready], planned) });
    await userEvent.type(within(dialog).getByLabelText("Shift PIN"), "5566");
    await userEvent.click(within(dialog).getByRole("button", { name: /carry on/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(svc.open).toHaveBeenLastCalledWith({ dateKey: "2026-10-21", shift: "DAY", pin: "5566", name: "Kumar" });
    // Still on the scan step, the typed ID still there.
    expect(screen.getByLabelText(/type the machine ID/i)).toHaveValue("L1");
  });

  it("'Change shift' forgets the token and goes back to the PIN screen", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: /change shift/i }));
    expect(screen.getByRole("heading", { name: /open the shift/i })).toBeInTheDocument();
    expect(stored).toBeNull();
  });
});
