import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceBills } from "./ServiceBills";
import { ServiceBill } from "./types";

const uploadMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()
);
const deleteMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()
);
const toast = vi.fn();
const serviceBillFile = vi.fn(
  async (_id: string) => new Blob(["x"], { type: "application/pdf" })
);

vi.mock("./hooks", () => ({
  // Added by the service-analytics panel the list page now mounts.
  useServiceAnalytics: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useProductionSeries: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachineSpend: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachineMutations: () => ({
    uploadServiceBill: { mutate: uploadMutate, isPending: false },
    deleteServiceBill: { mutate: deleteMutate, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./api", () => ({
  machineService: { serviceBillFile: (id: string) => serviceBillFile(id) },
}));

const bill = (over: Partial<ServiceBill> = {}): ServiceBill => ({
  _id: "b1",
  machine: "m1",
  serviceLog: "log1",
  kind: "service_bill",
  filename: "workshop-invoice.pdf",
  contentType: "application/pdf",
  size: 240_000,
  amount: 2500,
  createdAt: "2026-07-01T00:00:00.000Z",
  ...over,
});

const renderBills = (bills: ServiceBill[] = []) =>
  render(
    <ServiceBills machineId="m1" serviceLogId="log1" bills={bills} loading={false} />
  );

describe("ServiceBills", () => {
  beforeEach(() => {
    uploadMutate.mockClear();
    deleteMutate.mockClear();
    toast.mockClear();
    serviceBillFile.mockClear();
  });

  it("totals the attached bills", () => {
    renderBills([
      bill({ amount: 2500 }),
      bill({ _id: "b2", kind: "spare_bill", amount: 800, partName: "Drive belt A-42" }),
    ]);
    expect(screen.getByText("₹3,300")).toBeInTheDocument();
  });

  it("shows what a spare bill paid for", () => {
    renderBills([bill({ kind: "spare_bill", partName: "Drive belt A-42", vendor: "Sri Traders" })]);
    expect(screen.getByText(/Drive belt A-42 · Sri Traders/)).toBeInTheDocument();
    expect(screen.getByText("spare")).toBeInTheDocument();
  });

  it("fetches the file through the API rather than linking to it", async () => {
    // The auth cookie is httpOnly, so a bare href would not carry it.
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    renderBills([bill()]);
    await userEvent.click(screen.getByText("workshop-invoice.pdf"));

    expect(serviceBillFile).toHaveBeenCalledWith("b1");
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });

  it("uploads a spare bill with its part and amount", async () => {
    const user = userEvent.setup();
    renderBills();

    await user.click(screen.getByRole("button", { name: /attach bill/i }));
    await user.selectOptions(screen.getByLabelText(/bill type/i), "spare_bill");

    const file = new File(["%PDF"], "spare.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/^file/i), file);
    await user.type(screen.getByLabelText(/part fitted/i), "Drive belt A-42");
    await user.type(screen.getByLabelText(/amount/i), "800");

    await user.click(screen.getByRole("button", { name: /^upload bill$/i }));

    expect(uploadMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        machineId: "m1",
        serviceLogId: "log1",
        kind: "spare_bill",
        partName: "Drive belt A-42",
        amount: 800,
        file,
      }),
      expect.anything()
    );
  });

  it("refuses to submit with no file chosen", async () => {
    const user = userEvent.setup();
    renderBills();

    await user.click(screen.getByRole("button", { name: /attach bill/i }));
    await user.click(screen.getByRole("button", { name: /^upload bill$/i }));

    expect(uploadMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/choose the bill to attach/i)).toBeInTheDocument();
  });

  it("rejects an oversized file before it reaches the network", async () => {
    const user = userEvent.setup();
    renderBills();
    await user.click(screen.getByRole("button", { name: /attach bill/i }));

    const big = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    await user.upload(screen.getByLabelText(/^file/i), big);

    expect(screen.getByText(/the limit is 5 MB/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^upload bill$/i }));
    expect(uploadMutate).not.toHaveBeenCalled();
  });

  it("confirms before removing a bill", async () => {
    const user = userEvent.setup();
    renderBills([bill()]);

    await user.click(screen.getByRole("button", { name: /remove workshop-invoice\.pdf/i }));
    expect(deleteMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(deleteMutate).toHaveBeenCalledWith("b1", expect.anything());
  });
});
