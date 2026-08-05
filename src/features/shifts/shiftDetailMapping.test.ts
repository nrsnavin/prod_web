import { describe, it, expect, vi, beforeEach } from "vitest";

// productionService.shiftDetail does NOT pass the response through — it
// rebuilds each row field-by-field to rename the backend's
// machines/shiftType/totalRunMinutes into the shape this feature uses.
//
// That mapper is a silent data sink: anything it doesn't explicitly name
// is dropped between the API and the component, and TypeScript can't
// catch it because the mapper's own type simply omits the field. That is
// exactly how the outsourced marker reached production broken — the API
// sent productionMode, the component rendered it, and the seam in
// between threw it away.

const get = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return { ...actual, httpClient: { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const { productionService } = await import("./api");

const backendResponse = (job: Record<string, unknown> | null) => ({
  success: true,
  data: {
    shiftPlanId: "sp1",
    dateLabel: "05 Aug 2026",
    shiftType: "DAY",
    totalProduction: 210,
    finalized: false,
    summary: { totalMachines: 1, totalOperators: 1, totalProduction: 210, totalRunMinutes: 480 },
    machines: [
      {
        shiftDetailId: "sd1",
        status: "pending_verification",
        timer: "08:00:00",
        productionMeters: 120,
        machine: { machineID: "M-OUT" },
        employee: { name: "Ravi Kumar", department: "production" },
        job,
      },
    ],
  },
});

beforeEach(() => get.mockReset());

describe("productionService.shiftDetail — the job mapping seam", () => {
  it("carries productionMode and outsourceVendor through to the row", async () => {
    get.mockResolvedValue(
      backendResponse({ jobNo: 1, status: "weaving", productionMode: "outsource", outsourceVendor: "Sunrise Weaving" })
    );

    const res = await productionService.shiftDetail("sp1");
    const row = res.details[0];

    expect(row.job?.jobNo).toBe(1);
    expect(row.job?.productionMode).toBe("outsource");
    expect(row.job?.outsourceVendor).toBe("Sunrise Weaving");
  });

  it("leaves an in-house job unmarked", async () => {
    get.mockResolvedValue(backendResponse({ jobNo: 2, status: "weaving", productionMode: "in_house" }));

    const res = await productionService.shiftDetail("sp1");
    expect(res.details[0].job?.productionMode).toBe("in_house");
  });

  it("survives a job with no production mode at all", async () => {
    get.mockResolvedValue(backendResponse({ jobNo: 3, status: "weaving" }));

    const res = await productionService.shiftDetail("sp1");
    expect(res.details[0].job?.jobNo).toBe(3);
    expect(res.details[0].job?.productionMode).toBeUndefined();
  });

  it("still handles a row with no job", async () => {
    get.mockResolvedValue(backendResponse(null));

    const res = await productionService.shiftDetail("sp1");
    expect(res.details[0].job).toBeNull();
  });
});
