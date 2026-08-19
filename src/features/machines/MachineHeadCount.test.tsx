import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineHeadCountModal } from "./MachineHeadCountModal";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  A FIELD THAT RE-PRICES WORK
//
//  Head count is not a label. The planner divides metres by a rate
//  derived from it, the ETA posterior is keyed on it, and the
//  head→elastic map is indexed by it — so the server refuses the change
//  unless the loom is free, and this screen has to agree with that rule
//  rather than discover it.
//
//  The tests split three ways:
//
//    • the number cannot leave a sane range, because a typo here
//      becomes a rate estimate nobody believes;
//    • Save is inert until something has actually changed, so a
//      confirmation never fires for a no-op;
//    • a refusal is shown INLINE and stays. The server's message names
//      the status that blocked it, and that is the whole answer. Sent
//      to a toast it would delete itself after 3.5 seconds and leave a
//      dialog that looks like it worked.
// ══════════════════════════════════════════════════════════════════

const mutate = vi.fn();
vi.mock("./hooks", () => ({
  useMachineMutations: () => ({
    updateHeads: { mutate, isPending: false },
  }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const show = (current = 4) =>
  render(
    <MachineHeadCountModal
      machineId="m1"
      machineID="LOOM-07"
      current={current}
      onClose={() => {}}
    />
  );

const saveBtn = () => screen.getByRole("button", { name: /^save$/i });
const field = () => screen.getByRole("spinbutton", { name: /number of heads/i });

beforeEach(() => { mutate.mockReset(); toast.mockReset(); });

describe("MachineHeadCountModal", () => {
  it("opens on the loom's current count", () => {
    show(4);
    expect(field()).toHaveValue(4);
  });

  it("will not save until the number has actually changed", async () => {
    show(4);
    expect(saveBtn()).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /one more head/i }));
    expect(saveBtn()).toBeEnabled();
  });

  it("sends the new count with the machine's id", async () => {
    show(4);
    await userEvent.click(screen.getByRole("button", { name: /one more head/i }));
    await userEvent.click(saveBtn());

    expect(mutate).toHaveBeenCalledWith(
      { id: "m1", noOfHead: 5 },
      expect.anything()
    );
  });

  it("shows the change before it is committed", async () => {
    show(4);
    await userEvent.click(screen.getByRole("button", { name: /one more head/i }));
    expect(screen.getByText(/4 →/)).toBeInTheDocument();
  });

  it("cannot go below one — a loom with no heads cannot weave", async () => {
    show(1);
    expect(screen.getByRole("button", { name: /one fewer head/i })).toBeDisabled();
  });

  it("refuses a typed number outside the range rather than sending it", async () => {
    show(4);
    await userEvent.clear(field());
    await userEvent.type(field(), "400");
    await userEvent.click(saveBtn());

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/between 1 and 64/i);
  });

  it("keeps a server refusal on screen, in the server's own words", async () => {
    // The case this exists for: the loom starts running between opening
    // the dialog and saving. The message names the status, which is the
    // only thing that explains the refusal.
    show(4);
    await userEvent.click(screen.getByRole("button", { name: /one more head/i }));
    mutate.mockImplementation((_v, opts) =>
      opts.onError(
        new ApiError(
          'Head count can only be updated when the machine is free (current status: "running").',
          400
        )
      )
    );
    await userEvent.click(saveBtn());

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/only be updated when the machine is free/i);
    expect(alert).toHaveTextContent(/running/);
    // Not a toast — a toast would delete itself and leave a dialog that
    // looks like it worked.
    expect(toast).not.toHaveBeenCalled();
  });

  it("confirms in words a person would use when it works", async () => {
    show(4);
    await userEvent.click(screen.getByRole("button", { name: /one more head/i }));
    mutate.mockImplementation((_v, opts) => opts.onSuccess());
    await userEvent.click(saveBtn());

    expect(toast).toHaveBeenCalledWith("LOOM-07 now has 5 heads", "success");
  });

  it("says head, not heads, for one", async () => {
    show(2);
    await userEvent.click(screen.getByRole("button", { name: /one fewer head/i }));
    mutate.mockImplementation((_v, opts) => opts.onSuccess());
    await userEvent.click(saveBtn());

    expect(toast).toHaveBeenCalledWith("LOOM-07 now has 1 head", "success");
  });

  it("clears a stale error once the number is touched again", async () => {
    show(4);
    await userEvent.clear(field());
    await userEvent.type(field(), "400");
    await userEvent.click(saveBtn());
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await userEvent.clear(field());
    await userEvent.type(field(), "6");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
