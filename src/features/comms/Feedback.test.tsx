import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { FeedbackPage } from "./FeedbackPage";
import type { FeedbackItem } from "./api";

// ══════════════════════════════════════════════════════════════════
//  THE FEEDBACK INBOX, AGAINST WHAT THE SERVER REALLY SENDS AND TAKES
//
//  Found reading the page line by line beside api/feedback.js.
//
//  • IT SHOWED NO FEEDBACK. The page read `message` (or `text`); a note
//    has a `subject` and a `body`. Every card was a name, a category and
//    an empty line — in the list and in the reply form alike.
//  • ITS REPLY WAS ALWAYS REFUSED. "Send response" sent the status
//    "responded", which is not one (open, in_review, resolved, rejected,
//    closed): 400, every time. The "Responded" filter listed nothing for
//    the same reason, and three real statuses had no filter at all.
//  • A note whose author's record is gone read "Anonymous".
// ══════════════════════════════════════════════════════════════════

let listed: FeedbackItem[] = [];
const list = vi.fn(async (_status: string) => listed);
const respond = vi.fn(async (_id: string, _body: { response?: string; status?: string }) => ({}));
vi.mock("./api", async () => ({
  ...(await vi.importActual<typeof import("./api")>("./api")),
  feedbackService: {
    list: (status: string) => list(status),
    respond: (id: string, body: { response?: string; status?: string }) => respond(id, body),
  },
}));
vi.mock("./FeedbackThemes", () => ({ FeedbackThemes: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));

beforeEach(() => { listed = []; list.mockClear(); respond.mockClear(); });

let seq = 0;
const note = (over: Partial<FeedbackItem> = {}): FeedbackItem => {
  seq += 1;
  return {
    _id: `f${seq}`, employee: { _id: "e1", name: "Ravi", department: "weaving" }, type: "complaint", category: "facilities",
    subject: "Canteen water", body: "The cooler has been broken since Monday.", isAnonymous: false, status: "open",
    createdAt: "2026-11-19T04:00:00.000Z", ...over,
  };
};
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><FeedbackPage /></MemoryRouter>
    </QueryClientProvider>
  );

describe("what a worker wrote", () => {
  it("is on the card: the subject, and what was said", async () => {
    listed = [note()];
    renderPage();
    // Before: neither — the card read a field the server does not send.
    expect(await screen.findByText("Canteen water")).toBeInTheDocument();
    expect(screen.getByText("The cooler has been broken since Monday.")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
  });

  it("is in the reply form too", async () => {
    listed = [note()];
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /respond/i }));
    const form = within(await screen.findByRole("dialog"));
    expect(form.getByText("Canteen water")).toBeInTheDocument();
    expect(form.getByText("The cooler has been broken since Monday.")).toBeInTheDocument();
  });

  it("says Anonymous only of a note sent anonymously", async () => {
    listed = [
      note({ subject: "Night shift supervisor", isAnonymous: true, employee: null }),
      // The author's record was removed since: not the same thing.
      note({ subject: "Old note", isAnonymous: false, employee: null }),
    ];
    renderPage();
    const anon = (await screen.findByText("Night shift supervisor")).closest("div.min-w-0")!;
    expect(within(anon as HTMLElement).getByText("Anonymous")).toBeInTheDocument();
    const old = screen.getByText("Old note").closest("div.min-w-0")!;
    // Before: "Anonymous" — which it never was.
    expect(within(old as HTMLElement).queryByText("Anonymous")).not.toBeInTheDocument();
    expect(within(old as HTMLElement).getByText("Unknown employee")).toBeInTheDocument();
  });

  it("shows the reply, who gave it, and when", async () => {
    listed = [note({ status: "resolved", response: "A new cooler is fitted.", respondedBy: { name: "Owner" }, respondedAt: "2026-11-12T06:00:00.000Z" })];
    renderPage();
    expect(await screen.findByText("A new cooler is fitted.")).toBeInTheDocument();
    expect(screen.getByText("Owner · 12 Nov 2026")).toBeInTheDocument();
  });
});

describe("replying", () => {
  const open = async (item: FeedbackItem, button: RegExp = /respond/i) => {
    listed = [item];
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: button }));
    return within(await screen.findByRole("dialog"));
  };

  it("sends a status the server has", async () => {
    const item = note();
    const form = await open(item);
    await userEvent.type(form.getByLabelText("Response to feedback"), "A new cooler is ordered.");
    await userEvent.click(form.getByRole("button", { name: "Send response" }));
    // Before: status "responded" — refused, every time.
    expect(respond).toHaveBeenCalledWith(item._id, { response: "A new cooler is ordered.", status: "resolved" });
  });

  it("lets the status be chosen: still being looked into", async () => {
    const item = note();
    const form = await open(item);
    await userEvent.type(form.getByLabelText("Response to feedback"), "We are looking into it.");
    await userEvent.selectOptions(form.getByLabelText("Status"), "in_review");
    await userEvent.click(form.getByRole("button", { name: "Send response" }));
    expect(respond).toHaveBeenCalledWith(item._id, { response: "We are looking into it.", status: "in_review" });
  });

  it("says nothing of a reply it did not change", async () => {
    const item = note({ status: "resolved", response: "A new cooler is fitted.", respondedBy: { name: "Owner" } });
    const form = await open(item, /update reply/i);
    expect(form.getByLabelText("Status")).toHaveValue("resolved");
    await userEvent.selectOptions(form.getByLabelText("Status"), "closed");
    await userEvent.click(form.getByRole("button", { name: "Send response" }));
    // The server keeps the reply, and who gave it.
    expect(respond).toHaveBeenCalledWith(item._id, { response: undefined, status: "closed" });
  });

  it("needs something said (unchanged)", async () => {
    const form = await open(note());
    expect(form.getByRole("button", { name: "Send response" })).toBeDisabled();
  });

  it("is not offered on a closed note (unchanged)", async () => {
    listed = [note({ status: "closed", response: "Done." })];
    renderPage();
    await screen.findByText("Canteen water");
    expect(screen.queryByRole("button", { name: /respond|update reply/i })).not.toBeInTheDocument();
  });
});

describe("the filters", () => {
  it("are the statuses a note can have", async () => {
    renderPage();
    await screen.findByText("No feedback");
    for (const name of ["All", "Open", "In review", "Resolved", "Rejected", "Closed"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    // Before: "Responded" — a status no note has, so it listed nothing.
    expect(screen.queryByRole("button", { name: "Responded" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "In review" }));
    expect(list).toHaveBeenLastCalledWith("in_review");
  });

  it("the chip on a card reads as words", async () => {
    listed = [note({ status: "in_review" })];
    renderPage();
    await screen.findByText("Canteen water");
    const card = screen.getByText("Canteen water").closest("div.flex")!;
    expect(within(card as HTMLElement).getByText("in review")).toBeInTheDocument();
  });
});
