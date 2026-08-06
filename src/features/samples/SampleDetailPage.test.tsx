import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SampleDetailPage } from "./SampleDetailPage";
import type { SampleDetail, SampleStatus } from "./types";

// The page is the log. What it must never do is lose an entry, let a
// non-admin end a request, or let an end be recorded without a reason —
// those three are the whole point of keeping a sample file at all.

const { addLog, setStatus, addPhoto, removePhoto, sample, role } = vi.hoisted(() => ({
  addLog: vi.fn(),
  setStatus: vi.fn(),
  addPhoto: vi.fn(),
  removePhoto: vi.fn(),
  sample: { current: null as SampleDetail | null },
  role: { current: "admin" as string },
}));

vi.mock("./hooks", () => ({
  useSample: () => ({ data: sample.current, isLoading: false, isError: false, error: null }),
  useSampleMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    addLog: { mutate: addLog, isPending: false },
    setStatus: { mutate: setStatus, isPending: false },
    addPhoto: { mutate: addPhoto, isPending: false },
    removePhoto: { mutate: removePhoto, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/auth/useAuth", () => ({
  useAuth: () => ({ user: { _id: "u1", name: "Owner", role: role.current } }),
}));

const detail = (over: Partial<SampleDetail> = {}): SampleDetail => ({
  _id: "s1",
  sampleNo: 42,
  title: "Navy 25mm woven",
  customer: null,
  customerName: "Zenith Apparel",
  details: "25mm, navy, 120% elongation.",
  quantity: 50,
  targetDate: null,
  priority: "normal",
  status: "open" as SampleStatus,
  raisedByName: "Sales Desk",
  closedAt: null,
  createdAt: "2026-07-01T05:00:00.000Z",
  updatedAt: "2026-07-01T05:00:00.000Z",
  logCount: 1,
  photoCount: 0,
  lastEntry: null,
  photos: [],
  log: [
    {
      _id: "l1", kind: "created", note: "", status: "open", fromStatus: null,
      photo: null, byName: "Sales Desk", at: "2026-07-01T05:00:00.000Z",
    },
  ],
  ...over,
});

function renderPage(d: SampleDetail = detail(), as = "admin") {
  sample.current = d;
  role.current = as;
  return render(
    <MemoryRouter initialEntries={["/samples/s1"]}>
      <Routes>
        <Route path="/samples/:id" element={<SampleDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  addLog.mockClear();
  setStatus.mockClear();
  removePhoto.mockClear();
});

describe("the log", () => {
  it("shows every entry, oldest first, with its author and what kind it was", () => {
    renderPage(detail({
      log: [
        { _id: "l1", kind: "created", note: "Asked for over the phone.", status: "open",
          fromStatus: null, photo: null, byName: "Sales Desk", at: "2026-07-01T05:00:00.000Z" },
        { _id: "l2", kind: "update", note: "Warped 60 m on loom 4.", status: null,
          fromStatus: null, photo: null, byName: "Floor Lead", at: "2026-07-02T05:00:00.000Z" },
        { _id: "l3", kind: "status", note: "Approved by the customer.", status: "completed",
          fromStatus: "in_progress", photo: null, byName: "Owner", at: "2026-07-03T05:00:00.000Z" },
      ],
    }));

    expect(screen.getByText("Sample raised")).toBeInTheDocument();
    expect(screen.getByText("Asked for over the phone.")).toBeInTheDocument();
    expect(screen.getByText("Warped 60 m on loom 4.")).toBeInTheDocument();
    // A status entry says where it came from, so the log reads on its own.
    expect(screen.getByText("In progress → Completed")).toBeInTheDocument();
    expect(screen.getByText(/Floor Lead/)).toBeInTheDocument();

    const entries = document.querySelectorAll("ol > li");
    expect(entries).toHaveLength(3);
    expect(entries[0].textContent).toContain("Sample raised");
    expect(entries[2].textContent).toContain("Approved by the customer.");
  });

  it("sends an update and refuses to send an empty one", async () => {
    const user = userEvent.setup();
    renderPage();
    const button = screen.getByRole("button", { name: /add to log/i });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/add an update/i), "Second trial run.");
    await user.click(button);
    expect(addLog.mock.calls[0][0]).toMatchObject({ id: "s1", note: "Second trial run." });
  });

  it("takes no updates once the sample is ended, and says who can undo that", () => {
    renderPage(detail({ status: "closed", closedAt: "2026-07-04T05:00:00.000Z" }));
    expect(screen.queryByLabelText(/add an update/i)).not.toBeInTheDocument();
    expect(screen.getByText(/an admin can reopen it/i)).toBeInTheDocument();
  });
});

describe("ending a sample", () => {
  it("is offered to an admin only", () => {
    renderPage(detail(), "production");
    expect(screen.queryByRole("button", { name: /mark completed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^close$/i })).not.toBeInTheDocument();

    renderPage(detail(), "admin");
    expect(screen.getByRole("button", { name: /mark completed/i })).toBeInTheDocument();
  });

  it("will not complete without a reason", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /mark completed/i }));

    const confirm = screen.getByRole("button", { name: /^completed$/i });
    expect(confirm).toBeDisabled();
    expect(setStatus).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/why\?/i), "Approved by the customer.");
    await user.click(confirm);
    expect(setStatus.mock.calls[0][0]).toMatchObject({
      id: "s1", status: "completed", note: "Approved by the customer.",
    });
  });

  it("holds a reopen to the same standard — it undoes somebody's decision", async () => {
    const user = userEvent.setup();
    renderPage(detail({ status: "completed", closedAt: "2026-07-04T05:00:00.000Z" }));
    await user.click(screen.getByRole("button", { name: /reopen/i }));

    const confirm = screen.getByRole("button", { name: /^in progress$/i });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/why\?/i), "Customer wants it wider.");
    await user.click(confirm);
    expect(setStatus.mock.calls[0][0]).toMatchObject({ status: "in_progress" });
  });

  it("does not ask a reason to start work — that is not a decision to justify", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /start work/i }));
    expect(screen.getByRole("button", { name: /^in progress$/i })).toBeEnabled();
  });
});

describe("photos", () => {
  const photo = (over = {}) => ({
    _id: "p1",
    caption: "Trial off loom 4",
    filename: "trial.png",
    contentType: "image/png",
    size: 1024,
    uploadedByName: "Floor Lead",
    createdAt: "2026-07-02T05:00:00.000Z",
    removed: false,
    removedAt: null,
    removalReason: "",
    ...over,
  });

  it("shows each photo with its caption and who took it", () => {
    renderPage(detail({ photos: [photo()], photoCount: 1 }));
    expect(screen.getByAltText("Trial off loom 4")).toBeInTheDocument();
    expect(screen.getByText(/Floor Lead/)).toBeInTheDocument();
  });

  // The log says a photo was put here; the gallery must not contradict it.
  it("keeps a removed photo's tile, showing why it went", () => {
    renderPage(detail({
      photos: [photo({ removed: true, removalReason: "Photo of the wrong sample" })],
    }));
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.getByText("Photo of the wrong sample")).toBeInTheDocument();
    expect(screen.queryByAltText("Trial off loom 4")).not.toBeInTheDocument();
  });

  it("offers removal to an admin only, and needs a reason", async () => {
    const user = userEvent.setup();
    renderPage(detail({ photos: [photo()] }), "production");
    expect(screen.queryByRole("button", { name: /remove photo/i })).not.toBeInTheDocument();

    renderPage(detail({ photos: [photo()] }), "admin");
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
    const confirm = screen.getByRole("button", { name: /^remove$/i });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/why is it being removed/i), "Wrong sample");
    await user.click(confirm);
    expect(removePhoto.mock.calls[0][0]).toMatchObject({ photoId: "p1", reason: "Wrong sample" });
  });

  it("takes no new photos once the sample is ended", () => {
    renderPage(detail({ status: "completed", closedAt: "2026-07-04T05:00:00.000Z" }));
    expect(screen.queryByRole("button", { name: /add photo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/reopen it to add photos/i)).toBeInTheDocument();
  });
});
