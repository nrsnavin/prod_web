import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, Link } from "react-router-dom";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";

// ══════════════════════════════════════════════════════════════════
//  TWENTY MINUTES OF TYPING, AND A CLICK ON THE SIDEBAR
//
//  The dirty-form guard lived only in the modal components. The forms
//  that occupy a whole page — the quote builder, a purchase order —
//  had none, and there was no navigation blocker or unload handler
//  anywhere in the codebase. A stray click threw the lot away without
//  a word.
//
//  The tests hold the three things that make a guard trustworthy:
//
//    • it stops the navigation, and Cancel really does stay put —
//      a confirm dialog whose Cancel still navigates is worse than no
//      dialog, because it teaches people the answer does not matter;
//    • it is SILENT when there is nothing to lose. A guard that asks
//      on every exit gets clicked through without reading, and then it
//      is not a guard;
//    • it does not fire on a same-page navigation. Typing in a filter
//      changes the search params, and asking "discard your changes?"
//      at that moment would be nonsense.
// ══════════════════════════════════════════════════════════════════

function Page({ when }: { when: boolean }) {
  return (
    <>
      <UnsavedChangesGuard when={when} what="this quotation" />
      <Link to="/elsewhere">Leave</Link>
      <Link to="/here?sort=name">Sort</Link>
      <p>The form</p>
    </>
  );
}

const show = (when: boolean) =>
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          { path: "/here", element: <Page when={when} /> },
          { path: "/elsewhere", element: <p>Somewhere else</p> },
        ],
        { initialEntries: ["/here"] }
      )}
    />
  );

const leave = () => screen.getByRole("link", { name: /^leave$/i });

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("leaving with unsaved work", () => {
  it("stops the navigation and says what is at risk", async () => {
    show(true);
    await userEvent.click(leave());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/unsaved changes to this quotation/i)).toBeInTheDocument();
    expect(screen.queryByText("Somewhere else")).not.toBeInTheDocument();
  });

  it("stays put when the answer is no", async () => {
    // The load-bearing one. A Cancel that navigates anyway teaches
    // people that the question is decoration.
    show(true);
    await userEvent.click(leave());
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByText("The form")).toBeInTheDocument();
    expect(screen.queryByText("Somewhere else")).not.toBeInTheDocument();
  });

  it("goes when the answer is yes", async () => {
    show(true);
    await userEvent.click(leave());
    await userEvent.click(screen.getByRole("button", { name: /discard and leave/i }));

    expect(await screen.findByText("Somewhere else")).toBeInTheDocument();
  });

  it("names discarding as the destructive choice", async () => {
    show(true);
    await userEvent.click(leave());
    // Not "OK". The button says what it does.
    expect(screen.getByRole("button", { name: /discard and leave/i })).toBeInTheDocument();
  });
});

describe("when there is nothing to lose", () => {
  it("does not ask at all", async () => {
    // A guard that fires on every exit is clicked through unread, and
    // then it is not protecting anything.
    show(false);
    await userEvent.click(leave());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("Somewhere else")).toBeInTheDocument();
  });
});

describe("staying on the same page", () => {
  it("does not ask when only the query string changes", async () => {
    // Typing in a filter is not leaving the form.
    show(true);
    await userEvent.click(screen.getByRole("link", { name: /^sort$/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("The form")).toBeInTheDocument();
  });
});

describe("closing the tab", () => {
  it("registers an unload handler while there is work to lose", () => {
    const add = vi.spyOn(window, "addEventListener");
    show(true);
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("registers none when there is not", () => {
    const add = vi.spyOn(window, "addEventListener");
    show(false);
    const calls = add.mock.calls.filter(([evt]) => evt === "beforeunload");
    expect(calls).toHaveLength(0);
  });

  it("asks the browser to intervene", () => {
    // preventDefault is what actually triggers the browser's prompt;
    // the message string is ignored by every current browser.
    const handlers: EventListenerOrEventListenerObject[] = [];
    vi.spyOn(window, "addEventListener").mockImplementation((evt, h) => {
      if (evt === "beforeunload") handlers.push(h);
    });
    show(true);

    const event = new Event("beforeunload", { cancelable: true });
    (handlers[0] as EventListener)(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
