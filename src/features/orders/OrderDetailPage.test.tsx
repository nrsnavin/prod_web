import { describe, it, expect } from "vitest";
import { requirementRequired, requirementAvailable } from "./OrderDetailPage";
import { jobRefId, jobRefNo, jobRefStatus } from "./orderJobRef";
import { RawMaterialRequirement } from "./types";

describe("raw material requirement mapping", () => {
  // The order-detail endpoint returns rows shaped like this.
  const fromApi: RawMaterialRequirement = {
    rawMaterial: "abc123",
    name: "Nylon 40D",
    unit: "kg",
    requiredWeight: 30,
    inStock: 12,
    stockSufficient: false,
  };

  it("reads requiredWeight from the order-detail payload (regression: showed 0)", () => {
    expect(requirementRequired(fromApi)).toBe(30);
  });

  it("reads inStock from the order-detail payload (regression: showed —)", () => {
    expect(requirementAvailable(fromApi)).toBe(12);
  });

  it("falls back to legacy required/available names", () => {
    expect(requirementRequired({ required: 8 })).toBe(8);
    expect(requirementRequired({ quantity: 5 })).toBe(5);
    expect(requirementAvailable({ available: 3 })).toBe(3);
    expect(requirementAvailable({ stock: 2 })).toBe(2);
  });

  it("defaults required to 0 and available to null when nothing is present", () => {
    expect(requirementRequired({})).toBe(0);
    expect(requirementAvailable({})).toBeNull();
  });
});

describe("job reference link mapping", () => {
  // Shape returned by get-orderDetail, which does `.populate("jobs.job")`.
  const populated = {
    job: { _id: "job-mongo-id", jobOrderNo: 42, status: "Weaving" },
    no: 42,
  };

  it("extracts the job's _id from the populated object (regression: Invalid job ID)", () => {
    // The bug used `j.job` directly, yielding an object → /jobs/[object Object].
    expect(jobRefId(populated)).toBe("job-mongo-id");
  });

  it("uses the ref number, else the populated jobOrderNo", () => {
    expect(jobRefNo(populated)).toBe(42);
    expect(jobRefNo({ job: { _id: "x", jobOrderNo: 7 } })).toBe(7);
  });

  it("reads status from the populated job", () => {
    expect(jobRefStatus(populated)).toBe("Weaving");
  });

  it("still works when job is an unpopulated id string", () => {
    expect(jobRefId({ job: "plain-id", no: 3 })).toBe("plain-id");
    expect(jobRefNo({ job: "plain-id", no: 3 })).toBe(3);
  });

  it("falls back to top-level _id / jobOrderNo / status", () => {
    expect(jobRefId({ _id: "top-id" })).toBe("top-id");
    expect(jobRefNo({ jobOrderNo: 9 })).toBe(9);
    expect(jobRefStatus({ status: "Open" })).toBe("Open");
  });
});
