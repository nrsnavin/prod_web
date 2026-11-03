import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MachineIssuesPage } from "./MachineIssuesPage";

// What the worker said, written up, with the same fault already open
// pointed at before a second issue is opened for it.

const create = vi.fn(async (_b: unknown) => ({}));
vi.mock("./api", () => ({
  issueService: {
    list: async () => [],
    anomalies: async () => ({ windowDays: 30, threshold: 3, anomalies: [] }),
    create: (b: unknown) => create(b as never),
    intake: async () => ({
      title: "Head 3 rubber breaking", description: "Rubber on head 3 breaks every few minutes since morning.", severity: "high",
      duplicateOf: "i1", confidence: 0.8, aiGenerated: true, aiSuggestion: "ai5",
      openIssues: [{ _id: "i1", title: "Head 3 rubber cutting", status: "acknowledged" }],
    }),
  },
}));
vi.mock("@/features/machines/api", () => ({ machineService: { list: async () => [{ _id: "m1", ID: "L-07" }] } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("reporting a machine issue in the worker's words", () => {
  it("writes it up, warns that it looks already open, and reports with the AI row", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><MachineIssuesPage /></MemoryRouter></QueryClientProvider>);
    await userEvent.click(await screen.findByRole("button", { name: /report/i }));
    await userEvent.click(screen.getByText("Select machine"));
    await userEvent.click(await screen.findByText("Machine L-07"));
    await userEvent.type(screen.getByLabelText("What is wrong — say it or type it"), "head 3 la rubber cut aagudhu");
    await userEvent.click(screen.getByRole("button", { name: /write it up/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Head 3 rubber cutting");
    expect(screen.getByLabelText("Title *")).toHaveValue("Head 3 rubber breaking");
    expect(screen.getByLabelText("Severity")).toHaveValue("high");
    const buttons = screen.getAllByRole("button", { name: /^report issue$/i });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ machineId: "m1", title: "Head 3 rubber breaking", severity: "high", aiSuggestion: "ai5" }));
  });
});
