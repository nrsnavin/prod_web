import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductionModeControl } from "./ProductionModeControl";

// Capture what the production-mode mutation is called with.
const setProductionMode = vi.fn((_args: unknown, opts?: { onSuccess?: () => void }) => {
  opts?.onSuccess?.();
});

vi.mock("./hooks", () => ({
  useJobMutations: () => ({
    setProductionMode: { mutate: setProductionMode, isPending: false },
  }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function renderControl(props: React.ComponentProps<typeof ProductionModeControl>) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ProductionModeControl {...props} />
    </QueryClientProvider>
  );
}

describe("ProductionModeControl", () => {
  beforeEach(() => setProductionMode.mockClear());

  it("switches an outsourced job back to in-house", async () => {
    const user = userEvent.setup();
    renderControl({ jobId: "j1", mode: "outsource", vendor: "Acme Weaving" });

    await user.click(screen.getByRole("button", { name: /in-house/i }));

    expect(setProductionMode).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "j1", mode: "in_house" }),
      expect.anything()
    );
  });

  it("opens the vendor dialog and outsources with the entered vendor", async () => {
    const user = userEvent.setup();
    renderControl({ jobId: "j1", mode: "in_house" });

    await user.click(screen.getByRole("button", { name: /outsource/i }));
    // Dialog is open with the vendor field.
    const field = await screen.findByPlaceholderText(/Sri Sakthi/i);
    await user.type(field, "Sri Sakthi");
    await user.click(screen.getByRole("button", { name: /set outsource/i }));

    expect(setProductionMode).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "j1", mode: "outsource", vendor: "Sri Sakthi" }),
      expect.anything()
    );
  });

  it("shows the current vendor when outsourced", () => {
    renderControl({ jobId: "j1", mode: "outsource", vendor: "Acme Weaving" });
    expect(screen.getByText(/Vendor: Acme Weaving/)).toBeInTheDocument();
  });

  it("does not re-fire when clicking In-house on an already in-house job", async () => {
    const user = userEvent.setup();
    renderControl({ jobId: "j1", mode: "in_house" });

    await user.click(screen.getByRole("button", { name: /in-house/i }));

    expect(setProductionMode).not.toHaveBeenCalled();
  });
});

// Once the job leaves the loom the server refuses the change (409), so
// the control must not offer it — otherwise the only feedback is an error
// toast after the click.
describe("ProductionModeControl — production lock", () => {
  beforeEach(() => setProductionMode.mockClear());

  it.each(["finishing", "checking", "packing", "completed", "cancelled"])(
    "cannot be changed on a %s job", async (jobStatus) => {
      const user = userEvent.setup();
      renderControl({ jobId: "j1", mode: "in_house", jobStatus });

      for (const b of screen.getAllByRole("button")) await user.click(b).catch(() => {});
      expect(setProductionMode).not.toHaveBeenCalled();
    });

  it("explains why it is unavailable", () => {
    renderControl({ jobId: "j1", mode: "in_house", jobStatus: "finishing" });
    expect(screen.getByText(/Production closed — this job has moved to finishing/)).toBeInTheDocument();
  });

  it("still works while the job is on the loom", async () => {
    const user = userEvent.setup();
    renderControl({ jobId: "j1", mode: "outsource", vendor: "Sunrise", jobStatus: "weaving" });

    await user.click(screen.getByRole("button", { name: /in-house/i }));
    expect(setProductionMode).toHaveBeenCalled();
  });
});
