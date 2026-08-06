import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SampleListPage } from "./SampleListPage";
import type { SampleListResponse, SampleRow } from "./types";

// A list of titles and dates would make people open every request to
// find the one that moved, so the row's real job is to say what happened
// LAST. These tests are about that line and the tab counts.

const { data } = vi.hoisted(() => ({ data: { current: null as SampleListResponse | null } }));

vi.mock("./hooks", () => ({
  useSamples: () => ({ data: data.current, isLoading: false, isError: false, error: null }),
  useSampleMutations: () => ({ create: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const row = (over: Partial<SampleRow> = {}): SampleRow => ({
  _id: "s1",
  sampleNo: 42,
  title: "Navy 25mm woven",
  customer: null,
  customerName: "Zenith Apparel",
  details: "25mm navy",
  quantity: 50,
  targetDate: null,
  priority: "normal",
  status: "open",
  raisedByName: "Sales Desk",
  closedAt: null,
  createdAt: "2026-07-01T05:00:00.000Z",
  updatedAt: "2026-07-01T05:00:00.000Z",
  logCount: 3,
  photoCount: 2,
  lastEntry: null,
  ...over,
});

function renderList(res: Partial<SampleListResponse> = {}) {
  data.current = {
    total: 1,
    page: 1,
    limit: 25,
    pages: 1,
    counts: { open: 2, in_progress: 1, completed: 4, closed: 3 },
    samples: [row()],
    ...res,
  };
  return render(
    <MemoryRouter>
      <SampleListPage />
    </MemoryRouter>
  );
}

describe("the sample list", () => {
  it("names the sample, what was asked for and for whom", () => {
    renderList();
    expect(screen.getByText("S-42")).toBeInTheDocument();
    expect(screen.getByText("Navy 25mm woven")).toBeInTheDocument();
    expect(screen.getByText(/Zenith Apparel · 50 m/)).toBeInTheDocument();
  });

  it("reads back the last entry, whatever kind it was", () => {
    renderList({
      samples: [
        row({ lastEntry: { kind: "update", note: "Warped 60 m on loom 4.", status: null, byName: "Floor Lead", at: "2026-07-02T05:00:00.000Z" } }),
        row({ _id: "s2", sampleNo: 43, lastEntry: { kind: "status", note: "Approved.", status: "completed", byName: "Owner", at: "2026-07-03T05:00:00.000Z" } }),
        row({ _id: "s3", sampleNo: 44, lastEntry: { kind: "photo", note: "Shade card", status: null, byName: "Floor Lead", at: "2026-07-03T05:00:00.000Z" } }),
        row({ _id: "s4", sampleNo: 45, lastEntry: null }),
      ],
    });
    expect(screen.getByText("Warped 60 m on loom 4.")).toBeInTheDocument();
    expect(screen.getByText("Marked completed — Approved.")).toBeInTheDocument();
    expect(screen.getByText("Photo — Shade card")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("counts the tabs, and folds open + in progress into one live tab", () => {
    renderList();
    expect(screen.getByRole("button", { name: "Live (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completed (4)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Closed (3)" })).toBeInTheDocument();
  });

  it("says the list is empty rather than showing an empty table", () => {
    renderList({ samples: [], total: 0 });
    expect(screen.getByText("No sample requests")).toBeInTheDocument();
  });
});
