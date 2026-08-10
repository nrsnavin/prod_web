import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MachineAssignModal } from "./MachineAssignModal";
import { JobDetail } from "./types";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  A MACHINE WITH TOO FEW HOOKS
//
//  A weaving head has a fixed number of hooks; an elastic's recipe says
//  how many it needs. Put a 24-hook product on a 12-hook machine and it
//  cannot be woven as specified — found out at the machine, with the
//  beam already up.
//
//  The server refuses with HOOKS_EXCEED_MACHINE and names what does not
//  fit. That is a question, not a failure: the floor sometimes runs a
//  product on a smaller machine deliberately. So the screen has to ASK,
//  naming the products, and send the confirmation on the second
//  attempt — showing it as a red error toast would leave somebody with
//  nothing to do but give up.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const planMutate = vi.fn();

vi.mock("./hooks", () => ({
  useJobMutations: () => ({ planWeaving: { mutate: planMutate, isPending: false } }),
}));
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return {
    ...actual,
    httpClient: {
      get: vi.fn().mockResolvedValue({
        success: true,
        machines: [{ _id: "m1", ID: "M-1", NoOfHead: 1, NoOfHooks: 12, manufacturer: "Acme" }],
      }),
    },
  };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const job = {
  id: "j1",
  jobNo: "J-12",
  status: "preparatory",
  plannedElastics: [{ elasticId: "e1", elasticName: "20mm Woven", quantity: 500 }],
} as unknown as JobDetail;

/** What the server sends when the product needs more hooks than there are. */
const hookRefusal = () =>
  new ApiError(
    "Machine M-1 has 12 hooks per head, but this elastic needs more — 20mm Woven needs 24. Confirm to assign it anyway.",
    409,
    undefined,
    "HOOKS_EXCEED_MACHINE",
    {
      details: {
        machineName: "M-1",
        machineHooks: 12,
        elastics: [{ elastic: "e1", name: "20mm Woven", noOfHook: 24, excess: 12 }],
      },
    }
  );

const renderModal = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MachineAssignModal job={job} open onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const pickMachine = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /select machine/i }));
  await user.click(await screen.findByRole("option", { name: /M-1/ }));
};

const assign = async (user: ReturnType<typeof userEvent.setup>) => {
  await pickMachine(user);
  await user.click(screen.getByRole("button", { name: /^assign machine$/i }));
};

beforeEach(() => {
  toast.mockClear();
  planMutate.mockClear();
});

describe("assigning a product the machine cannot run", () => {
  beforeEach(() => {
    // First attempt refuses; a confirmed second attempt succeeds.
    planMutate.mockImplementation((vars: { confirmHooks?: boolean }, opts) => {
      if (vars.confirmHooks) {
        opts?.onSuccess?.({ success: true, message: "", weavingHeld: null });
      } else {
        opts?.onError?.(hookRefusal());
      }
    });
  });

  it("asks, naming the machine and what it cannot run", async () => {
    const user = userEvent.setup();
    renderModal();
    await assign(user);

    expect(screen.getByText(/too few hooks/i)).toBeInTheDocument();
    expect(screen.getByText(/12 hooks per head/i)).toBeInTheDocument();
    expect(screen.getByText(/20mm Woven needs 24/i)).toBeInTheDocument();
  });

  it("does not report it as an error the person cannot act on", async () => {
    const user = userEvent.setup();
    renderModal();
    await assign(user);

    expect(toast).not.toHaveBeenCalled();
  });

  it("sends the confirmation on the second attempt", async () => {
    const user = userEvent.setup();
    renderModal();
    await assign(user);

    await user.click(screen.getByRole("button", { name: /assign anyway/i }));

    expect(planMutate).toHaveBeenCalledTimes(2);
    expect(planMutate.mock.calls[0][0]).toMatchObject({ confirmHooks: false });
    expect(planMutate.mock.calls[1][0]).toMatchObject({ confirmHooks: true });
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/is now weaving/), "success"
    );
  });

  it("assigns nothing when the question is declined", async () => {
    const user = userEvent.setup();
    renderModal();
    await assign(user);

    // The dialog's own Cancel, not the assign screen's behind it —
    // clicking that one would be a different action entirely. The
    // dialog mounts last, so it is the last match.
    const cancels = screen.getAllByRole("button", { name: /^cancel$/i });
    await user.click(cancels[cancels.length - 1]);

    expect(planMutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/12 hooks per head/i)).not.toBeInTheDocument();
  });
});

describe("assigning a product that fits", () => {
  it("goes straight through, with nothing to confirm", async () => {
    planMutate.mockImplementation((_vars, opts) =>
      opts?.onSuccess?.({ success: true, message: "", weavingHeld: null })
    );
    const user = userEvent.setup();
    renderModal();
    await assign(user);

    expect(screen.queryByText(/too few hooks/i)).not.toBeInTheDocument();
    expect(planMutate).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/is now weaving/), "success");
  });
});

describe("an assignment that fails for some other reason", () => {
  it("is still reported as an error", async () => {
    // The hook question must not swallow everything else.
    planMutate.mockImplementation((_vars, opts) =>
      opts?.onError?.(new ApiError("Machine is not free (current: \"maintenance\")", 400))
    );
    const user = userEvent.setup();
    renderModal();
    await assign(user);

    expect(screen.queryByText(/too few hooks/i)).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/not free/), "error");
  });
});
