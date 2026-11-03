import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { FileComplaintModal } from "./FileComplaintModal";
import { waNumber } from "./ReplyPanel";

// What the customer sent fills the complaint: the category, their words
// in English, the job they most likely mean — and the elastic only when
// they named it. What is filed carries the AI row it settles.

const create = vi.fn(async (_b: unknown) => ({ success: true, data: {} }));
const intake = vi.fn(async () => ({
  category: "width", reason: "The 40mm white measures 38mm", confidence: 0.8, aiGenerated: true, aiSuggestion: "ai7", candidates: 4,
  elastic: { _id: "e2", name: "40mm White" },
  jobs: [{ _id: "j2", jobOrderNo: 112, date: "2026-10-28", status: "completed", elastics: [{ _id: "e2", name: "40mm White" }], why: "only job with 40mm white" }],
}));
vi.mock("./api", () => ({ complaintService: { create: (b: unknown) => create(b as never), intake: (...a: unknown[]) => intake(...(a as [])) } }));
vi.mock("@/features/customers/api", () => ({ customerService: { list: async () => ({ customers: [{ _id: "c1", name: "Sunrise Garments" }] }) } }));
vi.mock("@/features/jobs/api", () => ({ jobService: { list: async () => ({ jobs: [] }) } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("filing a complaint from the customer's message", () => {
  it("fills the form, names the job and why, and files with the AI row", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><FileComplaintModal onClose={() => {}} /></MemoryRouter></QueryClientProvider>);
    await userEvent.click(document.querySelectorAll<HTMLElement>("[aria-haspopup=\"listbox\"]")[0]);
    await userEvent.click(await screen.findByText("Sunrise Garments"));
    await userEvent.type(screen.getByLabelText("What the customer sent (optional)"), "40mm white coming 38mm only sir");
    await userEvent.click(screen.getByRole("button", { name: /fill the form from it/i }));
    expect(intake).toHaveBeenCalledWith("c1", "40mm white coming 38mm only sir", []);
    expect(await screen.findByText(/only job with 40mm white/)).toBeInTheDocument();
    expect(screen.getByText(/They named/)).toHaveTextContent("40mm White");
    expect(screen.getByLabelText("What they said")).toHaveValue("The 40mm white measures 38mm");
    await userEvent.click(screen.getByRole("button", { name: /file complaint/i }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ customer: "c1", job: "j2", elastic: "e2", category: "width", aiSuggestion: "ai7", feedback: expect.stringMatching(/^As the customer sent it:/) }));
  });

  it("opens WhatsApp on an Indian mobile with the country code", () => {
    expect(waNumber("98765 43210")).toBe("919876543210");
    expect(waNumber("+91 98765 43210")).toBe("919876543210");
    expect(waNumber("0421-22")).toBe("");
  });
});
