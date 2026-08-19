import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineEditModal } from "./MachineEditModal";
import { ApiError } from "@/core/http/httpClient";
import type { MachineDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  EDITING A MACHINE, AND BEING ASKED FIRST
//
//  Two of these four fields decide things rather than describe them:
//  hooks per head is what the fit check measures every elastic against,
//  and the ID is what the loom is called on printed plans. Getting one
//  wrong is not a typo somebody notices — it is a machine that quietly
//  stops being offered for products it can run.
//
//  So the tests hold three things:
//
//    • the confirmation has CONTENT. "Are you sure?" is not a
//      confirmation; a list of exactly which fields change, old beside
//      new, is. It must show what changed and nothing else.
//    • only what changed is sent. A PATCH that resends every field
//      would let a stale form overwrite somebody else's edit.
//    • the two gated fields are locked before the attempt, not after
//      it, and the reason is on screen.
// ══════════════════════════════════════════════════════════════════

const mutate = vi.fn();
vi.mock("./hooks", () => ({
  // Added by the service-analytics panel the list page now mounts.
  useServiceAnalytics: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useProductionSeries: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachineSpend: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachineMutations: () => ({ updateDetails: { mutate, isPending: false } }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const detail = (over: Partial<MachineDetail> = {}): MachineDetail => ({
  id: "LOOM-07",
  status: "free",
  manufacturer: "Comez",
  heads: 8,
  hooks: 24,
  dateOfPurchase: "2019-04-01",
  elastics: [],
  result: [],
  serviceLogs: [],
  ...over,
});

const show = (over: Partial<MachineDetail> = {}) =>
  render(
    <MachineEditModal machineId="m1" machine={detail(over)} onClose={() => {}} />
  );

const field = (name: RegExp) => screen.getByLabelText(name);
const review = () => screen.getByRole("button", { name: /review changes/i });
const saveBtn = () => screen.getByRole("button", { name: /save changes/i });

/** Types a fresh value into a field, replacing what was there. */
async function retype(name: RegExp, value: string) {
  await userEvent.clear(field(name));
  if (value) await userEvent.type(field(name), value);
}

beforeEach(() => { mutate.mockReset(); toast.mockReset(); });

describe("the form", () => {
  it("opens on the machine's stored values", () => {
    show();
    expect(field(/machine id/i)).toHaveValue("LOOM-07");
    expect(field(/manufacturer/i)).toHaveValue("Comez");
    expect(field(/hooks per head/i)).toHaveValue(24);
    expect(field(/purchased/i)).toHaveValue("2019-04-01");
  });

  it("will not review a change of nothing, and says why", () => {
    show();
    expect(review()).toBeDisabled();
    // The greyed button is not left to explain itself.
    expect(screen.getByText(/nothing has changed yet/i)).toBeInTheDocument();
  });

  it("treats a typed-then-deleted character as no change", async () => {
    // Dirty-flag tracking gets this wrong; comparing to the stored
    // value does not.
    show();
    await userEvent.type(field(/manufacturer/i), "X");
    await userEvent.type(field(/manufacturer/i), "{backspace}");
    expect(review()).toBeDisabled();
  });

  it("refuses an empty ID rather than sending one", async () => {
    show();
    await retype(/machine id/i, "");
    expect(screen.getByText(/needs an id/i)).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it("refuses a hook count outside a sane range", async () => {
    show();
    await retype(/hooks per head/i, "900");
    expect(screen.getByText(/between 1 and 200/i)).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it("says head count is edited elsewhere rather than just omitting it", async () => {
    // A field somebody expects and cannot find reads as a bug.
    show();
    expect(screen.getByText(/head count \(8\) is changed separately/i)).toBeInTheDocument();
  });
});

describe("the confirmation", () => {
  it("lists the field that changed, old beside new", async () => {
    show();
    await retype(/manufacturer/i, "Jakob Muller");
    await userEvent.click(review());

    expect(screen.getByText(/one detail will change/i)).toBeInTheDocument();
    expect(screen.getByText("Comez")).toBeInTheDocument();
    expect(screen.getByText("Jakob Muller")).toBeInTheDocument();
  });

  it("does not list the fields that did not change", async () => {
    show();
    await retype(/manufacturer/i, "Jakob Muller");
    await userEvent.click(review());

    // The ID is untouched, so naming it here would be noise that makes
    // the real change harder to spot.
    expect(screen.queryByText(/machine id/i)).not.toBeInTheDocument();
  });

  it("counts them when more than one changes", async () => {
    show();
    await retype(/manufacturer/i, "Jakob Muller");
    await retype(/hooks per head/i, "36");
    await userEvent.click(review());

    expect(screen.getByText(/2 details will change/i)).toBeInTheDocument();
  });

  it("spells out what a hook change actually costs", async () => {
    // "24 → 12" does not read as "this loom stops being offered for
    // wide products".
    show();
    await retype(/hooks per head/i, "12");
    await userEvent.click(review());

    expect(screen.getByText(/decides which elastics/i)).toBeInTheDocument();
  });

  it("warns that a rename leaves old plans behind", async () => {
    show();
    await retype(/machine id/i, "LOOM-09");
    await userEvent.click(review());

    expect(screen.getByText(/past production plans keep the old name/i)).toBeInTheDocument();
  });

  it("can be backed out of without saving", async () => {
    show();
    await retype(/manufacturer/i, "Jakob Muller");
    await userEvent.click(review());
    await userEvent.click(screen.getByRole("button", { name: /back to editing/i }));

    expect(field(/manufacturer/i)).toHaveValue("Jakob Muller");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends only the fields that changed", async () => {
    // A PATCH carrying every field lets a stale form silently overwrite
    // somebody else's edit to a field this user never touched.
    show();
    await retype(/manufacturer/i, "Jakob Muller");
    await userEvent.click(review());
    await userEvent.click(saveBtn());

    expect(mutate).toHaveBeenCalledWith(
      { id: "m1", patch: { manufacturer: "Jakob Muller" }, confirmHooks: false },
      expect.anything()
    );
  });

  it("sends the hook count as a number, not a string", async () => {
    show();
    await retype(/hooks per head/i, "36");
    await userEvent.click(review());
    await userEvent.click(saveBtn());

    expect(mutate.mock.calls[0][0].patch).toEqual({ NoOfHooks: 36 });
  });

  it("sends null to clear the purchase date", async () => {
    show();
    await retype(/purchased/i, "");
    await userEvent.click(review());
    await userEvent.click(saveBtn());

    expect(mutate.mock.calls[0][0].patch).toEqual({ DateOfPurchase: null });
  });

  it("confirms in words a person would use", async () => {
    show();
    await retype(/manufacturer/i, "Jakob Muller");
    await userEvent.click(review());
    mutate.mockImplementation((_v, opts) => opts.onSuccess());
    await userEvent.click(saveBtn());

    expect(toast).toHaveBeenCalledWith("Manufacturer updated", "success");
  });
});

describe("when the loom is not free", () => {
  it("locks the ID and the hook count, and says which status is blocking", () => {
    show({ status: "running" });
    expect(field(/machine id/i)).toBeDisabled();
    expect(field(/hooks per head/i)).toBeDisabled();
    expect(screen.getAllByText(/locked while the loom is running/i).length).toBe(2);
  });

  it("still lets the manufacturer be corrected", async () => {
    // Nothing computes from it. Refusing a typo fix because a job is on
    // the loom would be arbitrary.
    show({ status: "running" });
    expect(field(/manufacturer/i)).toBeEnabled();
    await retype(/manufacturer/i, "Jakob Muller");
    expect(review()).toBeEnabled();
  });

  it("still lets the purchase date be corrected in maintenance", () => {
    show({ status: "maintenance" });
    expect(field(/purchased/i)).toBeEnabled();
  });
});

describe("when the server refuses", () => {
  it("keeps the message on screen and returns to the form", async () => {
    // A refusal that leaves you staring at a confirmation you cannot
    // complete is a dead end.
    show();
    await retype(/machine id/i, "LOOM-09");
    await userEvent.click(review());
    mutate.mockImplementation((_v, opts) =>
      opts.onError(new ApiError('Machine with ID "LOOM-09" already exists.', 409))
    );
    await userEvent.click(saveBtn());

    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
    expect(field(/machine id/i)).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it("asks rather than refuses when lowering hooks strands an elastic", async () => {
    show();
    await retype(/hooks per head/i, "12");
    await userEvent.click(review());
    mutate.mockImplementation((_v, opts) =>
      opts.onError(
        new ApiError(
          "Machine LOOM-07 has 12 hooks per head, but this elastic needs more — Wide 24H needs 24. Confirm to assign it anyway.",
          409,
          undefined,
          "HOOKS_EXCEED_MACHINE"
        )
      )
    );
    await userEvent.click(saveBtn());

    // The server's sentence, intact, with a control that answers it.
    expect(screen.getByRole("alert")).toHaveTextContent(/Wide 24H needs 24/);
    expect(screen.getByRole("button", { name: /change it anyway/i })).toBeInTheDocument();
  });

  it("goes ahead once somebody says so on the record", async () => {
    show();
    await retype(/hooks per head/i, "12");
    await userEvent.click(review());
    mutate.mockImplementation((_v, opts) =>
      opts.onError(new ApiError("needs more", 409, undefined, "HOOKS_EXCEED_MACHINE"))
    );
    await userEvent.click(saveBtn());

    mutate.mockReset();
    await userEvent.click(screen.getByRole("button", { name: /change it anyway/i }));

    expect(mutate).toHaveBeenCalledWith(
      { id: "m1", patch: { NoOfHooks: 12 }, confirmHooks: true },
      expect.anything()
    );
  });
});
