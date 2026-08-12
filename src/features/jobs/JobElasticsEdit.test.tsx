import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  JobElasticsEditModal,
  canEditElastics,
  editableReason,
} from "./JobElasticsEditModal";
import { JobDetail } from "./types";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  CHANGING WHAT A JOB IS PLANNED TO MAKE
//
//  There is a window for this and it closes early. A job is raised by
//  drawing yarn against its quantities; once warping or covering has
//  started, or a batch has been raised, the material is committed and
//  the floor is working to a sheet. Editing the figures then would
//  leave the machine running to numbers the paperwork no longer shows.
//
//  So the button exists only while the job is preparatory and both
//  programmes are still open. The server holds the same rule — it is
//  the one that counts — but the screen holds it too, and says why,
//  because a button that appears and then refuses teaches nothing.
//
//  Two refusals come back from the server that are worth READING
//  rather than toasting: an edit that would change the over-planned
//  quantity (the yarn for it is already drawn), and preparation that
//  has started behind the client's back. Both are shown in the form.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const updateMutate = vi.fn();

vi.mock("./hooks", () => ({
  useJobMutations: () => ({
    updateElastics: { mutate: updateMutate, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const job = {
  id: "j1",
  jobNo: "J-1042",
  status: "preparatory",
  warping: { status: "open" },
  covering: { status: "open" },
  plannedElastics: [
    { elasticId: "e1", elasticName: "20mm Woven", quantity: 500 },
    { elasticId: "e2", elasticName: "32mm Knitted", quantity: 250 },
  ],
} as unknown as JobDetail;

const setup = (j: JobDetail = job) =>
  render(<JobElasticsEditModal job={j} open onClose={() => {}} />);

const giveReason = async (user: ReturnType<typeof userEvent.setup>) =>
  user.type(screen.getByPlaceholderText(/why is this being changed/i), "Customer cut the order");

const qtyFor = (name: string) =>
  screen.getByLabelText(new RegExp(`planned quantity for ${name}`, "i"));

beforeEach(() => {
  toast.mockClear();
  updateMutate.mockClear();
});

describe("when the window is open", () => {
  it("is editable for a preparatory job with both programmes open", () => {
    expect(canEditElastics(job)).toBe(true);
    expect(editableReason(job)).toBeNull();
  });

  it("sends every line, not only the one that changed", async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(qtyFor("20mm Woven"));
    await user.type(qtyFor("20mm Woven"), "300");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save quantities/i }));

    // The route replaces the job's lines wholesale; sending only the
    // edited one would silently drop the other product from the job.
    expect(updateMutate.mock.calls[0][0]).toEqual({
      jobId: "j1",
      auditReason: "Customer cut the order",
      elastics: [
        { elastic: "e1", quantity: 300 },
        { elastic: "e2", quantity: 250 },
      ],
    });
  });
});

describe("when the window has closed", () => {
  it("names the status that closed it", () => {
    const weaving = { ...job, status: "weaving" } as unknown as JobDetail;
    expect(canEditElastics(weaving)).toBe(false);
    expect(editableReason(weaving)).toMatch(/preparatory/i);
    expect(editableReason(weaving)).toMatch(/weaving/i);
  });

  it("closes once warping has started, even while preparatory", () => {
    const started = {
      ...job,
      warping: { status: "completed" },
    } as unknown as JobDetail;
    expect(canEditElastics(started)).toBe(false);
    expect(editableReason(started)).toMatch(/warping has started/i);
  });

  it("closes once covering has started", () => {
    const started = {
      ...job,
      covering: { status: "in_progress" },
    } as unknown as JobDetail;
    expect(canEditElastics(started)).toBe(false);
    expect(editableReason(started)).toMatch(/covering has started/i);
  });

  it("stays open when a job has no warping or covering record at all", () => {
    const bare = { ...job, warping: null, covering: null } as unknown as JobDetail;
    expect(canEditElastics(bare)).toBe(true);
  });
});

describe("what the form refuses to send", () => {
  it("will not save without a reason", async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(qtyFor("20mm Woven"));
    await user.type(qtyFor("20mm Woven"), "300");
    await user.click(screen.getByRole("button", { name: /save quantities/i }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/reason/i), "error");
  });

  it("will not send an edit that changes nothing", async () => {
    const user = userEvent.setup();
    setup();

    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save quantities/i }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/nothing has changed/i), "error");
  });

  it("will not save a quantity of zero", async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(qtyFor("32mm Knitted"));
    await user.type(qtyFor("32mm Knitted"), "0");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save quantities/i }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/greater than 0/i), "error");
  });
});

describe("a refusal from the server", () => {
  // `code` is the fourth argument — the third is `cause`.
  const refuse = (code: string, message: string) =>
    updateMutate.mockImplementation((_body, opts) =>
      opts.onError(new ApiError(message, 409, undefined, code))
    );

  it("shows the excess refusal in the form, not as a toast", async () => {
    const user = userEvent.setup();
    refuse(
      "JOB_EXCESS_WOULD_CHANGE",
      "This edit changes the over-planned quantity (50 → 0), and the yarn has already been drawn."
    );
    setup();

    await user.clear(qtyFor("20mm Woven"));
    await user.type(qtyFor("20mm Woven"), "300");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save quantities/i }));

    expect(await screen.findByText(/over-planned quantity/i)).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), "error");
  });

  it("shows a preparation-started refusal the client could not have known about", async () => {
    const user = userEvent.setup();
    refuse(
      "JOB_PREPARATION_STARTED",
      "Quantities cannot be changed once preparation has started — 2 warping batch(es) already raised."
    );
    setup();

    await user.clear(qtyFor("20mm Woven"));
    await user.type(qtyFor("20mm Woven"), "300");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save quantities/i }));

    expect(await screen.findByText(/warping batch\(es\) already raised/i)).toBeInTheDocument();
  });

  it("toasts anything else", async () => {
    const user = userEvent.setup();
    updateMutate.mockImplementation((_b, opts) =>
      opts.onError(new ApiError("Job not found", 404))
    );
    setup();

    await user.clear(qtyFor("20mm Woven"));
    await user.type(qtyFor("20mm Woven"), "300");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save quantities/i }));

    expect(toast).toHaveBeenCalledWith("Job not found", "error");
  });
});
