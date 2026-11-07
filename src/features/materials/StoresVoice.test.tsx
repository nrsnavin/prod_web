import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StoresVoiceDialog } from "./StoresVoice";

// A typed (or spoken) line read into a movement, checked, saved to the job.

const post = vi.fn(async (url: string, _body?: unknown) => (url === "/materials/command" ? {
  by: "rules", aiSuggestion: "ai1", problems: [],
  draft: { action: "issue", quantity: 20, unit: "kg", material: { _id: "m1", name: "40s PC Black", unit: "kg", stock: 50 }, candidates: [], job: { _id: "j1", jobOrderNo: 512 }, jobNo: 512, lot: null, lotNo: null, heard: "issue 20 kg 40s black to job 512" },
} : { updated: [{ name: "40s PC Black", newStock: 30 }] }));
vi.mock("@/core/http/httpClient", () => ({ httpClient: { post: (u: string, b?: unknown) => post(u, b) }, ApiError: class extends Error {} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("saying what moved", () => {
  it("reads the line, shows the stock after, and saves it against the job", async () => {
    render(<QueryClientProvider client={new QueryClient()}><StoresVoiceDialog onClose={() => {}} /></QueryClientProvider>);
    await userEvent.type(screen.getByLabelText(/type it/i), "issue 20 kg 40s black to job 512");
    await userEvent.click(screen.getByRole("button", { name: "Read" }));
    expect(await screen.findByText(/To job J-512\. Stock after: 30 kg\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Material")).toHaveValue("m1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(post).toHaveBeenLastCalledWith("/materials/bulk-adjust-stock", {
      adjustments: [{ _id: "m1", adjustment: -20, action: "issue", reason: "Typed: issue 20 kg 40s black to job 512", job: "j1" }],
      aiSuggestion: "ai1",
    });
  });
});
