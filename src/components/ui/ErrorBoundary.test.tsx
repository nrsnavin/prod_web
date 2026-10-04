import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider, Link } from "react-router-dom";
import { ErrorBoundary, RouteError, isChunkLoadError } from "./ErrorBoundary";

// ══════════════════════════════════════════════════════════════════
//  ONE FAILURE, ONE PART OF THE SCREEN
//
//  A crash in a card leaves the rest of the page; a crash in a page
//  leaves the menus; an error outside any page gets a plain screen, not
//  React Router's developer page; and a tab left open across a deploy
//  is told to reload rather than shown a stack trace.
// ══════════════════════════════════════════════════════════════════

let explode = true;
function Bomb({ message = "boom" }: { message?: string }) {
  if (explode) throw new Error(message);
  return <p>All good</p>;
}

beforeEach(() => {
  explode = true;
  // React logs every caught render error; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("a section", () => {
  it("says which part failed, leaves its neighbours, and can try again", async () => {
    render(
      <>
        <ErrorBoundary variant="section" label="Low stock">
          <Bomb />
        </ErrorBoundary>
        <p>Attendance card</p>
      </>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Low stock couldn't be shown.");
    expect(screen.getByText("Attendance card")).toBeInTheDocument();

    explode = false;
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("clears itself when its record changes", () => {
    const { rerender } = render(
      <ErrorBoundary variant="section" resetKey="a">
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    explode = false;
    rerender(
      <ErrorBoundary variant="section" resetKey="b">
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });
});

describe("a hint inside a form", () => {
  it("disappears and leaves the form usable", () => {
    render(
      <form>
        <label>Metres <input /></label>
        <ErrorBoundary variant="hint">
          <Bomb />
        </ErrorBoundary>
      </form>
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Metres")).toBeInTheDocument();
  });
});

describe("a page inside the app", () => {
  const Shell = () => (
    <div>
      <nav>
        <Link to="/broken">Broken</Link>
        <Link to="/fine">Fine</Link>
      </nav>
      <ErrorBoundary variant="page">
        <Outlet />
      </ErrorBoundary>
    </div>
  );

  it("keeps the menu, and a move to another page clears it", async () => {
    const router = createMemoryRouter(
      [{
        path: "/", element: <Shell />, errorElement: <RouteError />,
        children: [
          { path: "broken", element: <Bomb /> },
          { path: "fine", element: <p>Fine page</p> },
        ],
      }],
      { initialEntries: ["/broken"] }
    );
    // As AppShell does: the boundary sits inside a block keyed by the page.
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { name: /this page couldn't be shown/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fine" })).toBeInTheDocument();
    explode = false;
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("All good")).toBeInTheDocument();
  });
});

describe("outside any page", () => {
  it("shows a plain screen, not React Router's developer page", () => {
    const router = createMemoryRouter([{ path: "/", element: <Bomb message="shell broke" />, errorElement: <RouteError /> }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText("shell broke")).toBeInTheDocument();
    expect(screen.queryByText(/hey developer/i)).not.toBeInTheDocument();
  });
});

describe("a tab left open across a deploy", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://erp/assets/OrdersPage-abc.js",
    "Importing a module script failed.",
    "error loading dynamically imported module",
  ])("recognises %s", (m) => {
    expect(isChunkLoadError(new Error(m))).toBe(true);
  });

  it("does not mistake an ordinary error for one", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("is offered a reload, not a stack trace", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(
      <ErrorBoundary variant="page">
        <Bomb message="Failed to fetch dynamically imported module: /assets/x.js" />
      </ErrorBoundary>
    );
    expect(screen.getByRole("heading", { name: /the app has been updated/i })).toBeInTheDocument();
    expect(screen.queryByText(/assets\/x\.js/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /reload/i }));
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
