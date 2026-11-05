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
  complete: vi.fn(),
  enter: vi.fn(),
  readTimerPhoto: vi.fn(),
  photoUsed: vi.fn(),
  previousTimerPhoto: vi.fn(),
  timerPhotoFileUrl: vi.fn(),
};
const qrFromPhoto = vi.fn();
vi.mock("./photoQr", () => ({ qrFromPhoto: (...a: unknown[]) => qrFromPhoto(...a) }));
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
const saved = (machine: FloorMachine, plan: FloorPlan = planned): EntrySaved => ({ machine, plan });

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
  svc.previousTimerPhoto.mockResolvedValue({ shift: { dateKey: "2026-10-20", shift: "NIGHT", label: "Night shift · 20 Oct 2026" }, operator: null, runTime: null, photo: null });
  svc.timerPhotoFileUrl.mockImplementation((id: string) => `/api/floor/timer-photo/${id}/file?floorToken=t`);
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
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Draft started with this loom/), "info");

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

  it("offers who ran the loom on its last same shift as one tap, which puts it on the shift", async () => {
    const unplanned = loom({ ID: "L1", suggestedOperator: { id: "o2", name: "Sita", why: "Ran this loom on the day shift of 20 Oct · marked present today" } });
    svc.open.mockResolvedValue({ token: "t", session, state: stateOf([unplanned]) });
    svc.shift.mockResolvedValue(stateOf([unplanned]));
    svc.setOperator.mockResolvedValue({ detailId: "d1", added: true, planCreated: true });
    render(<FloorPage />);
    await openWith();
    await userEvent.click(await screen.findByRole("button", { name: /L1/ }));

    const offer = await screen.findByRole("button", { name: /Sita.*Ran this loom on the day shift of 20 Oct · marked present today/ });
    // Nothing is chosen until it is pressed.
    expect(svc.setOperator).not.toHaveBeenCalled();
    await userEvent.click(offer);
    await waitFor(() => expect(svc.setOperator).toHaveBeenCalledWith("id-L1", "o2"));
    expect(await screen.findByLabelText("Operator")).toHaveValue("o2");
    // Chosen: no longer offered.
    expect(screen.queryByRole("button", { name: /Ran this loom/ })).not.toBeInTheDocument();
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

  it("fills from the loom's own learned rate when it has one, and says when the save was verified by the rule", async () => {
    const learned = { ...ready, rate: { metresPerHeadHour: 60, basis: "machine" as const, shifts: 30, pick: 12 } };
    await start([learned]);
    svc.machine.mockResolvedValue(learned);
    await userEvent.type(screen.getByLabelText(/type the machine ID/i), "L1");
    await userEvent.click(screen.getByRole("button", { name: /find/i }));
    const metres = await screen.findByLabelText(/production per head/i);
    expect(screen.getByText(/at this loom's rate, 60 m a head an hour at pick 12 \(from 30 shifts\)/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Run time"), "7:30");
    expect(metres).toHaveValue(450);
    expect(screen.getByText(/filled from the run time at this loom's rate/i)).toBeInTheDocument();

    const entered = { ...learned, entry: "verified" as const, detail: { ...ready.detail!, status: "closed", submitted: { production: 450, timer: "7:30:00", feedback: "", at: null, byName: "Kumar" } } };
    svc.enter.mockResolvedValue({ ...saved(entered), autoVerified: true });
    svc.shift.mockResolvedValue(stateOf([entered], planned));
    await userEvent.click(screen.getByRole("button", { name: /save and scan next/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/L1 saved — 450 m\/head.*verified: the photo and the loom's rate agree/), "success"));
  });

  it("one photo of the label and the timer: finds the loom from the label and reads the timer in the same photo", async () => {
    await start();
    svc.machine.mockResolvedValue(ready);
    qrFromPhoto.mockResolvedValue("MACHINE|id-L1|L1");
    svc.readTimerPhoto.mockResolvedValue({ reading: { displays: [{ text: "7:30:00", kind: "run_time", label: "", confidence: 0.95, alternatives: [] }], primary: 0, problem: null }, suggestionId: null, photoId: "ph1" });
    const photo = new File([new Uint8Array([1, 2])], "panel.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByTestId("label-and-timer-input"), photo);

    expect(qrFromPhoto).toHaveBeenCalledWith(photo);
    expect(svc.machine).toHaveBeenCalledWith("MACHINE|id-L1|L1");
    // The loom is on the shift: the same photo is read for its entry at once.
    await waitFor(() => expect(svc.readTimerPhoto).toHaveBeenCalledWith(photo, "d1"));
    await userEvent.click(await screen.findByRole("button", { name: /use this/i }));
    expect(screen.getByLabelText("Run time")).toHaveValue("7:30:00");
    expect(svc.readTimerPhoto).toHaveBeenCalledTimes(1);
  });

  it("one photo on a loom not on the shift waits for the operator, then is read and kept with the entry", async () => {
    const unplanned = loom({ ID: "L1" });
    await start([unplanned], null as unknown as FloorPlan);
    svc.machine.mockResolvedValue(unplanned);
    qrFromPhoto.mockResolvedValue("MACHINE|id-L1|L1");
    svc.setOperator.mockResolvedValue({ detailId: "d9", added: true, planCreated: true });
    svc.readTimerPhoto.mockResolvedValue({ reading: { displays: [], primary: null, problem: "glare" }, suggestionId: null, photoId: "ph2" });
    await userEvent.upload(screen.getByTestId("label-and-timer-input"), new File([new Uint8Array([1])], "p.jpg", { type: "image/jpeg" }));

    expect(await screen.findByText(/read for the run time once the loom is on the shift/)).toBeInTheDocument();
    expect(svc.readTimerPhoto).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText(/operator — puts this loom on the shift/i), "o1");
    await waitFor(() => expect(svc.readTimerPhoto).toHaveBeenCalledWith(expect.any(File), "d9"));
  });

  it("one photo with no label in it says so and stays on scanning", async () => {
    await start();
    qrFromPhoto.mockResolvedValue(null);
    await userEvent.upload(screen.getByTestId("label-and-timer-input"), new File([new Uint8Array([1])], "p.jpg", { type: "image/jpeg" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No loom label could be found in that photo/);
    expect(svc.machine).not.toHaveBeenCalled();
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
    expect(toast).not.toHaveBeenCalledWith(expect.stringMatching(/draft started/i), expect.anything());
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
      [loom({ ID: "L2", entry: "loading", loading: true, why: "Being loaded for its job — no production to enter." }), /being loaded/i],
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

  it("on a scanned loom, shows what its timer read the shift before — even unverified — and asks for a photo of this shift's timer", async () => {
    svc.previousTimerPhoto.mockResolvedValue({
      shift: { dateKey: "2026-10-20", shift: "NIGHT", label: "Night shift · 20 Oct 2026" }, operator: "Ravi", runTime: "7:45:00", verified: false, entryId: "d0",
      photo: { id: "ph9", takenAt: "2026-10-21T02:10:00Z", byName: "Night Sup", readText: "07:45:12", runTimeUsed: "7:45:00", used: true },
    });
    await start();
    await userEvent.click(screen.getByRole("button", { name: /L1/ }));
    const timer = await screen.findByRole("region", { name: "The loom's timer" });
    const card = await within(timer).findByLabelText("Timer the shift before");
    expect(svc.previousTimerPhoto).toHaveBeenCalledWith("id-L1");
    expect(card).toHaveTextContent("Shift before · Night shift · 20 Oct 2026");
    expect(card).toHaveTextContent("Timer read 7:45:00 · Ravi");
    expect(card).toHaveTextContent("Not verified yet — as the floor entered it.");
    expect(card).toHaveTextContent(/Photo by Night Sup at .* · used for the run time/);
    expect(within(card).getByRole("img")).toHaveAttribute("src", "/api/floor/timer-photo/ph9/file?floorToken=t");
    expect(within(card).getByRole("link", { name: /timer photo from the night shift/i })).toHaveAttribute("href", "/api/floor/timer-photo/ph9/file?floorToken=t");

    // The photo is asked for, right under the reading before, and the run time field follows it.
    const ask = within(timer).getByRole("button", { name: /take a photo of this shift's timer/i });
    expect(card.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ask.compareDocumentPosition(within(timer).getByLabelText("Run time")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The loom is on the shift, so the photo is kept with the entry: no reminder to choose the operator.
    expect(within(timer).queryByText(/choose the operator first/i)).not.toBeInTheDocument();
  });

  it("on a total-hours meter, starts this shift from where the meter stood when the shift before ended", async () => {
    svc.previousTimerPhoto.mockResolvedValue({
      shift: { dateKey: "2026-10-20", shift: "NIGHT", label: "Night shift · 20 Oct 2026" }, operator: "Ravi", runTime: "7:45:00", verified: false, entryId: "d0",
      photo: { id: "ph9", takenAt: "2026-10-21T02:10:00Z", byName: "Night Sup", readText: "1226.85", readKind: "hour_meter", runTimeUsed: "7:45:00", used: true, meterHours: 1226.85 },
    });
    svc.readTimerPhoto.mockResolvedValue({ reading: { displays: [{ text: "1234.6", kind: "hour_meter", label: "HRS", confidence: 0.95, alternatives: [] }], primary: 0, problem: null }, suggestionId: null, photoId: "ph10" });
    await start();
    await userEvent.click(screen.getByRole("button", { name: /L1/ }));
    const timer = await screen.findByRole("region", { name: "The loom's timer" });
    await within(timer).findByText(/Photo by Night Sup/);
    await userEvent.upload(screen.getByTestId("timer-photo-input"), new File([new Uint8Array([1])], "t.jpg", { type: "image/jpeg" }));

    // No question about the start: it is the shift before's end, said so, and can be changed.
    expect(await within(timer).findByText(/Meter 1226.85 h at the start — where it stood when the shift before ended/)).toBeInTheDocument();
    expect(within(timer).getByText(/from “1234.6”/).closest("p")).toHaveTextContent(/Run time 7:45:00\s*from “1234.6”/);
    await userEvent.click(within(timer).getByRole("button", { name: /use this/i }));
    expect(screen.getByLabelText("Run time")).toHaveValue("7:45:00");
    expect(svc.photoUsed).toHaveBeenCalledWith("ph10", "7:45:00", { start: 1226.85, end: 1234.6 }, undefined);
  });

  it("marks the shift before's reading verified once the office has signed it off", async () => {
    svc.previousTimerPhoto.mockResolvedValue({ shift: { dateKey: "2026-10-20", shift: "NIGHT", label: "Night shift · 20 Oct 2026" }, operator: "Ravi", runTime: "7:45:00", verified: true, entryId: "d0", photo: null });
    await start();
    await userEvent.click(screen.getByRole("button", { name: /L1/ }));
    const card = await screen.findByLabelText("Timer the shift before");
    await within(card).findByText(/Timer read/);
    expect(card).toHaveTextContent("Timer read 7:45:00 · Ravi");
    expect(card).toHaveTextContent("Verified by the office.");
    expect(card).toHaveTextContent("No timer photo was taken.");
  });

  it("says when the shift before entered nothing, or did not run this loom", async () => {
    svc.previousTimerPhoto.mockResolvedValueOnce({ shift: { dateKey: "2026-10-21", shift: "DAY", label: "Day shift · 21 Oct 2026" }, operator: "Sita", runTime: null, photo: null });
    await start();
    await userEvent.click(screen.getByRole("button", { name: /L1/ }));
    expect(await screen.findByText("No run time was entered (Sita).")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /back to scanning/i }));

    await userEvent.click(screen.getByRole("button", { name: /L1/ }));
    expect(await screen.findByText("This loom was not on that shift.")).toBeInTheDocument();
  });

  it("reminds that the photo is kept with the entry only once the operator puts the loom on the shift", async () => {
    await start([ready, loom({ ID: "L7" })]);
    await userEvent.click(screen.getByRole("button", { name: /L7/ }));
    const timer = await screen.findByRole("region", { name: "The loom's timer" });
    expect(within(timer).getByRole("button", { name: /take a photo of this shift's timer/i })).toBeInTheDocument();
    expect(within(timer).getByText(/choose the operator first, so the photo is kept/i)).toBeInTheDocument();
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

  it("Create shift plan: offered on a floor draft once something is entered, names the looms still to enter, and says what was free", async () => {
    const done = loom({ ID: "L1", entry: "entered", detail: { id: "d1", status: "pending_verification", operator: { id: "o1", name: "Ravi" }, operatorLocked: false, submitted: { production: 600, timer: null, feedback: "", at: null, byName: "Kumar" } } });
    const pending = loom({ ID: "L4", entry: "ready", detail: { id: "d4", status: "open", operator: { id: "o2", name: "Sita" }, operatorLocked: false, submitted: null } });
    await start([done, pending, loom({ ID: "L2", status: "free", job: null, entry: "free" })], fromFloor);
    expect(screen.getByRole("status")).toHaveTextContent(/noted as a draft the office can see/);
    expect(screen.getByText(/Press when every machine's production is entered/)).toBeInTheDocument();

    svc.complete.mockRejectedValueOnce(new ApiError("1 loom is still to enter: L4.", 409, undefined, "FLOOR_LOOMS_TO_ENTER", { details: { looms: [{ id: "id-L4", ID: "L4" }] } }));
    await userEvent.click(screen.getByRole("button", { name: /create shift plan/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("1 loom is still to enter: L4.");
    expect(svc.complete).toHaveBeenLastCalledWith(false);

    const completion = { completedAt: "2026-10-21T14:00:00Z", completedBy: "Kumar", freeMachines: [{ id: "id-L2", ID: "L2", why: "No job on this loom." }], loadingMachines: [{ id: "id-L3", ID: "L3", operatorName: "Sita" }] };
    svc.complete.mockResolvedValueOnce({ plan: { ...fromFloor, floor: completion }, entered: 1, toEnter: ["L4"], freeMachines: completion.freeMachines, loadingMachines: completion.loadingMachines });
    svc.shift.mockResolvedValue(stateOf([done, pending], { ...fromFloor, floor: completion }));
    await userEvent.click(within(dialog).getByRole("button", { name: /create anyway/i }));
    expect(svc.complete).toHaveBeenLastCalledWith(true);

    expect(await screen.findByText(/Shift plan created — the office confirms it\. 1 loom was free: L2\. Being loaded: L3 \(Sita\)\./)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith("Shift plan created — the office confirms it. 1 loom free: L2.", "success");
    expect(screen.queryByRole("button", { name: /create shift plan/i })).not.toBeInTheDocument();
  });

  it("a loom being loaded takes the operator loading it, with nothing to enter", async () => {
    const loadingLoom = loom({ ID: "L3", entry: "loading", loading: true, why: "Being loaded for its job — no production to enter. Put the operator loading it on the shift." });
    await start([ready, loadingLoom], fromFloor);
    svc.setOperator.mockResolvedValue({ detailId: "d3", added: true, planCreated: false });
    await userEvent.click(screen.getByRole("button", { name: /^L3/ }));
    expect(await screen.findByText(/no production to enter\. The operator loading it is on the shift/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/production per head/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Operator loading it"), "o2");
    await waitFor(() => expect(svc.setOperator).toHaveBeenCalledWith("id-L3", "o2"));
    expect(await screen.findByRole("status")).toHaveTextContent("Sita is on this loom this shift.");
    await userEvent.click(screen.getByRole("button", { name: /scan the next loom/i }));
    await screen.findByText(/entered$/);
  });

  it("Create shift plan is not offered on the office's plan, nor before anything is entered", async () => {
    await start([ready]);
    expect(screen.queryByRole("button", { name: /create shift plan/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /change shift/i }));
    svc.open.mockResolvedValue({ token: "t", session, state: stateOf([{ ...ready, detail: { ...ready.detail!, operatorLocked: false } }], fromFloor) });
    await openWith();
    expect(await screen.findByRole("button", { name: /create shift plan/i })).toBeDisabled();
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
