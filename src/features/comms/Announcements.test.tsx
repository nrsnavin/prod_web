import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ymd } from "@/core/format/date";
import { AnnouncementsPage, noticeState } from "./AnnouncementsPage";
import type { Announcement } from "@/features/dashboard/api";

// ══════════════════════════════════════════════════════════════════
//  THE ANNOUNCEMENTS PAGE, AGAINST WHAT THE SERVER TAKES AND SENDS
//
//  Found reading the page line by line beside api/announcement.js.
//
//  • IT OFFERED A KIND THE SERVER REFUSES. The list was info, warning,
//    urgent, celebration; the server's is info, warning, safety, policy,
//    celebration. "Urgent" was a 400, and a safety notice could not be
//    posted from here at all.
//  • A NOTICE FOR ONE DEPARTMENT COULD NOT HAVE AN END DATE: the
//    department box took the place of the date box.
//  • A DELETED NOTICE NEVER LEFT THE LIST. An admin is sent every notice,
//    removed and expired ones included; the page drew them all alike. So
//    "Delete" answered "deleted" and the notice stayed, looking live.
// ══════════════════════════════════════════════════════════════════

let listed: Announcement[] = [];
let me: { role: string } = { role: "admin" };
const create = vi.fn(async (_b: Record<string, unknown>) => ({}));
const update = vi.fn(async (_id: string, _b: Record<string, unknown>) => ({}));
const remove = vi.fn(async (_id: string) => ({}));
vi.mock("./api", async () => ({
  ...(await vi.importActual<typeof import("./api")>("./api")),
  announcementService: {
    list: async () => listed,
    create: (b: Record<string, unknown>) => create(b),
    update: (id: string, b: Record<string, unknown>) => update(id, b),
    remove: (id: string) => remove(id),
  },
}));
vi.mock("./NoticeTranslations", () => ({ NoticeTranslations: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: me }) }));

beforeEach(() => { listed = []; me = { role: "admin" }; create.mockClear(); update.mockClear(); remove.mockClear(); });

/** A calendar day `offset` days from today, as the server keeps one: its UTC midnight. */
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${ymd(d)}T00:00:00.000Z`;
};
let seq = 0;
const notice = (over: Partial<Announcement> = {}): Announcement => {
  seq += 1;
  return { _id: `a${seq}`, title: `Notice ${seq}`, body: "Friday at 4 pm", type: "info", audience: "all", isActive: true, createdAt: day(-3), ...over };
};
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><AnnouncementsPage /></MemoryRouter>
    </QueryClientProvider>
  );
const cardOf = (title: string) => within(screen.getByText(title).closest("[data-notice]") as HTMLElement);

describe("posting a notice", () => {
  const openForm = async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /new announcement/i }));
    return within(await screen.findByRole("dialog"));
  };

  it("offers the kinds the server has", async () => {
    const form = await openForm();
    const kinds = within(form.getByLabelText("Type")).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    // Before: info, warning, urgent, celebration — "urgent" was refused.
    expect(kinds).toEqual(["info", "warning", "safety", "policy", "celebration"]);
  });

  it("posts a safety notice", async () => {
    const form = await openForm();
    await userEvent.type(form.getByLabelText("Title *"), "Guard on loom 7");
    await userEvent.type(form.getByLabelText("Announcement text"), "Do not run it without the side guard.");
    await userEvent.selectOptions(form.getByLabelText("Type"), "safety");
    await userEvent.click(form.getByRole("button", { name: "Post announcement" }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: "Guard on loom 7", type: "safety", audience: "all" }));
  });

  it("lets a notice for one department have an end date", async () => {
    const form = await openForm();
    await userEvent.type(form.getByLabelText("Title *"), "Weaving: shift change");
    await userEvent.type(form.getByLabelText("Announcement text"), "Night shift starts at 8 from Monday.");
    await userEvent.selectOptions(form.getByLabelText("Audience"), "department");
    await userEvent.type(form.getByLabelText("Department"), "weaving");
    // Before: no such field once "One department" was chosen.
    const until = form.getByLabelText("Valid until");
    await userEvent.type(until, "2026-11-30");
    await userEvent.click(form.getByRole("button", { name: "Post announcement" }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ audience: "department", department: "weaving", validUntil: "2026-11-30" }));
  });
});

describe("where a notice stands", () => {
  it("is removed, expired, not yet up, or up", () => {
    expect(noticeState(notice())).toBe("live");
    expect(noticeState(notice({ isActive: false }))).toBe("removed");
    expect(noticeState(notice({ validUntil: day(-1) }))).toBe("expired");
    expect(noticeState(notice({ validFrom: day(2) }))).toBe("scheduled");
  });

  it("a notice is up through the day it is valid until", () => {
    expect(noticeState(notice({ validUntil: day(0) }))).toBe("live");
    // As the phone used to store it: its own midnight, as an instant.
    const d = new Date(); d.setHours(0, 0, 0, 0);
    expect(noticeState(notice({ validUntil: d.toISOString() }))).toBe("live");
  });

  it("removed says so first, whatever its dates", () => {
    expect(noticeState(notice({ isActive: false, validUntil: day(-5) }))).toBe("removed");
  });
});

describe("the admin's list", () => {
  it("marks a removed notice, and offers to put it back — not to delete it again", async () => {
    const gone = notice({ title: "Old canteen timings", isActive: false });
    const live = notice({ title: "Safety drill" });
    listed = [live, gone];
    renderPage();
    await screen.findByText("Safety drill");

    const card = cardOf("Old canteen timings");
    // Before: drawn exactly like a live one, with Pin and Delete.
    expect(card.getByText("removed")).toBeInTheDocument();
    expect(card.queryByTitle("Delete")).not.toBeInTheDocument();
    await userEvent.click(card.getByRole("button", { name: "Restore" }));
    expect(update).toHaveBeenCalledWith(gone._id, { isActive: true });

    const up = cardOf("Safety drill");
    expect(up.queryByText("removed")).not.toBeInTheDocument();
    expect(up.getByTitle("Delete")).toBeInTheDocument();
  });

  it("marks an expired notice, and says until when each is valid", async () => {
    listed = [
      notice({ title: "Diwali holiday", validUntil: "2026-11-10T00:00:00.000Z" }),
      notice({ title: "Stock count", validUntil: day(4) }),
    ];
    renderPage();
    await screen.findByText("Diwali holiday");
    expect(cardOf("Diwali holiday").getByText("expired")).toBeInTheDocument();
    expect(cardOf("Diwali holiday").getByText(/Until 10 Nov 2026/)).toBeInTheDocument();
    expect(cardOf("Stock count").queryByText("expired")).not.toBeInTheDocument();
    expect(cardOf("Stock count").getByText(/ · Until \d/)).toBeInTheDocument();
  });

  it("says what kind of notice it is, when it is not a plain one", async () => {
    listed = [notice({ title: "Guard on loom 7", type: "safety" }), notice({ title: "Tea at 4" })];
    renderPage();
    await screen.findByText("Guard on loom 7");
    expect(cardOf("Guard on loom 7").getByText("safety")).toBeInTheDocument();
    expect(cardOf("Tea at 4").queryByText("info")).not.toBeInTheDocument();
  });

  it("pins and unpins (unchanged)", async () => {
    const n = notice({ title: "Safety drill" });
    listed = [n];
    renderPage();
    await userEvent.click((await screen.findByText("Safety drill")).closest("[data-notice]")!.querySelector('[title="Pin"]')!);
    expect(update).toHaveBeenCalledWith(n._id, { isPinned: true });
  });
});

describe("for everyone else", () => {
  it("is the board, to read: no posting, no removing (unchanged)", async () => {
    me = { role: "production" };
    listed = [notice({ title: "Safety drill" })];
    renderPage();
    await screen.findByText("Safety drill");
    expect(screen.queryByRole("button", { name: /new announcement/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Pin")).not.toBeInTheDocument();
  });
});
