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
