import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { ApiError } from "@/core/http/httpClient";
import { isGone, useMachineMutations } from "./hooks";
import { machineService } from "./api";

// ══════════════════════════════════════════════════════════════════
//  A PAGE THAT OUTLIVED THE RECORD IT IS SHOWING
//
//  Reported as "why do I get machine not found while attaching a
//  bill". The page was displaying the machine, its service history and
//  an Attach bill button at the moment the server said no machine has
//  that id. Both were true: the page had loaded correctly, and the
//  record was removed from the database afterwards.
//
//  The app sets refetchOnWindowFocus: false — correct for a screen
//  left open on a shop floor all day, and it means nothing ever tells
//  the tab that what it is showing has gone. Every button on it stays
//  live, and the first thing to notice is whichever write the user
//  finally attempts.
//
//  So a 404 from a WRITE is read as news about the world rather than
//  as a rejected request: drop the cache and re-read, so the page
//  turns into "Machine not found" instead of asking the user to try
//  again on something that cannot work.
//
//  The distinction being pinned is 404 against everything else. A 400
//  or a 409 means the record is fine and the REQUEST was wrong;
//  throwing the cache away on those would refetch the whole machine
//  every time somebody mistypes a number.
// ══════════════════════════════════════════════════════════════════

vi.mock("./api", () => ({
  machineService: {
    uploadServiceBill: vi.fn(),
    updateDetails: vi.fn(),
    addServiceLog: vi.fn(),
    updateHeads: vi.fn(),
    updateElasticMap: vi.fn(),
    deleteServiceBill: vi.fn(),
    dismissFinding: vi.fn(),
    create: vi.fn(),
    setStatus: vi.fn(),
  },
}));

const DETAIL = ["machines", "detail", "m1"] as const;

let qc: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  // The cached machine the page is rendering from.
  qc.setQueryData(DETAIL, { _id: "m1", id: "LOOM-01", status: "free" });
});

/** Has the cached machine been marked for re-reading? */
const willRefetch = () => qc.getQueryState(DETAIL)?.isInvalidated === true;

const upload = () => {
  const { result } = renderHook(() => useMachineMutations(), { wrapper });
  // `mutate`, not `mutateAsync` — react-query swallows the rejection
  // internally, so the failure never escapes through act().
  result.current.uploadServiceBill.mutate({
    machineId: "m1", serviceLogId: "log1", kind: "service_bill",
    file: new File(["x"], "bill.pdf"),
  } as never);
};

describe("isGone", () => {
  it("is true only for a 404 from the API", () => {
    expect(isGone(new ApiError("gone", 404))).toBe(true);
    expect(isGone(new ApiError("bad request", 400))).toBe(false);
    expect(isGone(new ApiError("conflict", 409))).toBe(false);
    expect(isGone(new ApiError("server", 500))).toBe(false);
  });

  it("is false for anything that is not an ApiError", () => {
    // A network failure or a thrown TypeError says nothing about
    // whether the record still exists.
    expect(isGone(new Error("Network request failed"))).toBe(false);
    expect(isGone("404")).toBe(false);
    expect(isGone(null)).toBe(false);
  });
});

describe("attaching a bill to a machine that is gone", () => {
  it("re-reads the machine, so the page stops showing one that is not there", async () => {
    vi.mocked(machineService.uploadServiceBill).mockRejectedValue(
      new ApiError("No machine has id m1. It may have been deleted.", 404)
    );

    expect(willRefetch()).toBe(false);
    upload();

    await waitFor(() => expect(willRefetch()).toBe(true));
  });

  it("leaves the cache alone when the request was merely rejected", async () => {
    // The machine is fine; the upload was not. Refetching the whole
    // machine on every validation failure buys nothing and costs a
    // round trip on a connection that is often a phone in a shed.
    vi.mocked(machineService.uploadServiceBill).mockRejectedValue(
      new ApiError("Unsupported file type. Upload a PDF or a photo.", 400)
    );

    upload();

    await waitFor(() =>
      expect(vi.mocked(machineService.uploadServiceBill)).toHaveBeenCalled()
    );
    expect(willRefetch()).toBe(false);
    expect(qc.getQueryData(DETAIL)).toBeTruthy();
  });

  it("does not mistake a dropped connection for a deleted machine", async () => {
    // A plain Error is what a failed fetch produces. Treating it as
    // "the record is gone" would blank the page whenever the mill's
    // wifi drops.
    vi.mocked(machineService.uploadServiceBill).mockRejectedValue(
      new Error("Failed to fetch")
    );

    upload();

    await waitFor(() =>
      expect(vi.mocked(machineService.uploadServiceBill)).toHaveBeenCalled()
    );
    expect(willRefetch()).toBe(false);
  });
});

describe("every write that acts on an existing machine", () => {
  // One forgotten handler is one screen that keeps lying, and the
  // upload path is only the one that happened to get reported.
  it.each([
    ["addServiceLog", { machineId: "m1", body: {} }],
    ["updateHeads", { id: "m1", noOfHead: 8 }],
    ["updateDetails", { id: "m1", patch: {} }],
    ["updateElasticMap", { id: "m1", elastics: [] }],
    ["deleteServiceBill", "bill1"],
  ] as const)("recovers from a 404: %s", async (name, args) => {
    vi.mocked(machineService[name as keyof typeof machineService]).mockRejectedValue(
      new ApiError("gone", 404)
    );

    const { result } = renderHook(() => useMachineMutations(), { wrapper });
    (result.current[name as keyof typeof result.current] as {
      mutate: (v: unknown) => void;
    }).mutate(args);

    await waitFor(() => expect(willRefetch()).toBe(true));
  });
});
