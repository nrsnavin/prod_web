import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NewLeaveModal } from "./LeavePage";

const createFn = vi.fn().mockResolvedValue({ success: true });
const toast = vi.fn();

vi.mock("./api", () => ({
  leaveService: {
    create: (body: unknown) => createFn(body),
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
