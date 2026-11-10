import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProofOfDeliveryDialog } from "./ProofOfDeliveryDialog";

// The signed copy read into the delivery; a shortage opens a complaint
// against the order's job, with what they wrote.

const post = vi.fn(async () => ({ complaint: "c1" }));
vi.mock("@/core/http/httpClient", () => ({ httpClient: { post: (...a: unknown[]) => post(...(a as [])) }, ApiError: class extends Error {} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// Files go through the shared upload (core/http/upload.ts), like every other request.
const upload = vi.fn();
vi.mock("@/core/http/upload", () => ({ uploadForm: (...a: unknown[]) => upload(...(a as [])) }));
afterEach(() => upload.mockReset());

describe("proof of delivery", () => {
  it("fills from the signed copy and opens a complaint for the shortage", async () => {
    upload.mockResolvedValue({
      success: true, aiSuggestion: "ai7",
      read: { problem: null, dcNumber: "DC/26-27/0149", deliveredOn: "2026-11-05", receivedBy: "Ramesh (stores)", stamped: true, remark: "2 box short", issue: "short", shortPackages: 2 },
      checks: ["The copy says challan DC/26-27/0149; this is DC/26-27/0142."],
      complaint: { customer: "cu1", jobs: [{ _id: "j1", jobOrderNo: 512 }], category: "quantity", reason: "short on delivery of DC/26-27/0142: “2 box short”" },
    });
    render(<QueryClientProvider client={new QueryClient()}><ProofOfDeliveryDialog dc={{ _id: "d1", dcNumber: "DC/26-27/0142" }} onClose={() => {}} /></QueryClientProvider>);
    await userEvent.upload(screen.getByLabelText("proof of delivery photo"), new File([new Uint8Array([1])], "pod.jpg", { type: "image/jpeg" }));
    expect(await screen.findByLabelText("Received by")).toHaveValue("Ramesh (stores)");
    expect(screen.getByLabelText("Delivered on")).toHaveValue("2026-11-05");
    expect(screen.getByRole("alert")).toHaveTextContent("this is DC/26-27/0142");
    expect(screen.getByLabelText("Open a complaint for this")).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Record delivery" }));
    expect(post).toHaveBeenCalledWith("/dc/d1/pod", expect.objectContaining({
      deliveredOn: "2026-11-05", receivedBy: "Ramesh (stores)", issue: "short", source: "photo", aiSuggestion: "ai7",
      complaint: { job: "j1", reason: "short on delivery of DC/26-27/0142: “2 box short”" },
    }));
  });
});
