import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CollectionsTab } from "./CollectionsTab";

// Reminders on a schedule, and a customer's own reply in their history.

const svc = {
  collections: vi.fn(),
  autoRemind: vi.fn(),
  saveCollectionSettings: vi.fn(),
  runAutoRemind: vi.fn(),
  collectionHistory: vi.fn(),
};
vi.mock("./api", () => ({ accountsService: new Proxy({}, { get: (_t, k: string) => (svc as Record<string, unknown>)[k] }) }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
let role = "admin";
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role } }) }));

const entry = {
  party: "c1", partyName: "Sunrise Garments", total: 52500, overdue: 52500, oldestDays: 10, count: 1, docs: [], priority: 1,
  contact: { name: "Ravi", phone: "9840011111", email: "", accountant: "", accountantPhone: "", paymentTerms: "30" },
  lastContact: { kind: "reply", at: "2026-11-04T10:00:00Z", byName: "WhatsApp (customer)", note: "", channel: "whatsapp" },
  promise: null, recentlyContacted: true, held: false, next: { action: "remind", tone: "gentle", label: "Gentle reminder" },
};
const remind = (enabled: boolean) => ({
  success: true, whatsapp: true, more: 0,
  settings: { enabled, hour: 11, everyDays: 7, minOverdueDays: 3, acknowledgeReplies: false },
  send: [{ party: "c2", partyName: "Kumar Knits", overdue: 21000, oldestDays: 12, tone: "gentle", phone: "9840022222" }],
  skip: [{ party: "c1", partyName: "Sunrise Garments", overdue: 52500, why: "contacted in the last 7 days" }],
});
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><CollectionsTab /></MemoryRouter></QueryClientProvider>);

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
  toast.mockReset(); role = "admin";
  svc.collections.mockResolvedValue({ success: true, rows: [entry], total: 52500, whatsapp: true });
});

describe("reminders on a schedule", () => {
  it("are turned on by an admin, say who today's run reminds and why the rest are left, and can go now", async () => {
    svc.autoRemind.mockResolvedValueOnce(remind(false)).mockResolvedValue(remind(true));
    svc.saveCollectionSettings.mockResolvedValue({ success: true });
    wrap();
    const card = await screen.findByLabelText("Reminders on a schedule");
    expect(card).toHaveTextContent("At 11:00, to each customer 3+ days past due");
    expect(card).toHaveTextContent("Today: 1 to remind, 1 left.");
    await userEvent.click(within(card).getByRole("button", { name: "Who" }));
    const who = within(card).getByLabelText("Today's reminders");
    expect(who).toHaveTextContent("Kumar Knits · ₹21,000.00 · 12 days · gentle");
    expect(who).toHaveTextContent("Sunrise Garments — contacted in the last 7 days");

    await userEvent.click(within(card).getByLabelText("Send reminders on a schedule"));
    expect(svc.saveCollectionSettings).toHaveBeenCalledWith({ autoRemind: { enabled: true } });
    await userEvent.click(within(card).getByLabelText("Acknowledge replies"));
    expect(svc.saveCollectionSettings).toHaveBeenLastCalledWith({ acknowledgeReplies: true });

    svc.runAutoRemind.mockResolvedValue({ success: true, sent: 1 });
    await userEvent.click(await within(card).findByRole("button", { name: "Send today's now" }));
    expect(toast).toHaveBeenCalledWith("1 reminder sent", "success");
  });

  it("are shown, not changed, for anyone but an admin", async () => {
    role = "accounts";
    svc.autoRemind.mockResolvedValue(remind(true));
    wrap();
    const card = await screen.findByLabelText("Reminders on a schedule");
    expect(within(card).getByLabelText("Send reminders on a schedule")).toBeDisabled();
    expect(within(card).queryByRole("button", { name: "Send today's now" })).not.toBeInTheDocument();
  });
});

describe("a customer's reply", () => {
  it("shows in their history as they wrote it", async () => {
    svc.autoRemind.mockResolvedValue(remind(false));
    svc.collectionHistory.mockResolvedValue([
      { _id: "n1", kind: "reply", channel: "whatsapp", message: "Will pay Rs 50,000 by 15th", note: "promise", byName: "WhatsApp (customer)", createdAt: "2026-11-04T10:00:00Z" },
      { _id: "n2", kind: "promise", channel: "whatsapp", promiseDate: "2026-11-15", promiseAmount: 50000, byName: "WhatsApp (customer)", createdAt: "2026-11-04T10:00:00Z" },
    ]);
    wrap();
    await screen.findByText("Sunrise Garments");
    await userEvent.click(screen.getByRole("button", { name: /history/i }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Their reply")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("“Will pay Rs 50,000 by 15th”");
    expect(dialog).toHaveTextContent("₹50,000.00 by");
  });
});
