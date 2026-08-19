import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { JobQrPrint, jobUrl } from "./JobQrPrint";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A SHEET THAT GOES ON A DOCKET AND GETS SCANNED
//
//  Two properties carry this, and both are about the paper surviving
//  contact with a mill.
//
//    • The QR resolves to something. It encodes the job's own page on
//      the host the sheet was printed from, so a plain phone camera
//      opens it — no scanner app, nothing to configure. The other QR
//      codes in this system encode tagged strings that no scanner in
//      either repo reads.
//
//    • The paper works without the QR. A smudge, a flat battery or a
//      camera that will not focus must not make the sheet useless, so
//      every fact on it is also printed in words, and the URL is
//      printed as text under the code.
// ══════════════════════════════════════════════════════════════════

// QRCode.toDataURL touches canvas, which jsdom has no real
// implementation of. The QR's CONTENT is what matters here and it is
// asserted through the alt text, so the encoder itself is stubbed.
vi.mock("qrcode", () => ({
  default: { toDataURL: (v: string) => Promise.resolve(`data:image/png;base64,${btoa(v)}`) },
}));

const job = (over: Partial<JobDetail> = {}): JobDetail => ({
  id: "job-abc123",
  jobOrderNo: 42,
  jobNo: "JOB-42",
  date: "2026-08-10T00:00:00Z",
  status: "weaving",
  customerName: "Anand Garments",
  orderNo: 77,
  machine: {
    machineId: "m1", machineName: "LOOM-07",
    machineNoOfHead: 4, manufacturer: "Comez", status: "running",
  },
  plannedElastics: [{ elasticName: "20mm White", quantity: 1200 }],
  producedElastics: [{ elasticName: "20mm White", quantity: 800 }],
  packedElastics: [{ elasticName: "20mm White", quantity: 500 }],
  wastageElastics: [],
  warping: { status: "completed" },
  covering: { status: "pending" },
  shiftDetails: [],
  wastages: [],
  ...over,
} as JobDetail);

const show = (j: JobDetail = job()) =>
  render(<JobQrPrint job={j} open onClose={() => {}} />);

describe("jobUrl", () => {
  it("points at the job page on the host the sheet is printed from", () => {
    // Baked-in hosts are how somebody scanning in the mill gets sent to
    // a machine they cannot reach.
    expect(jobUrl("abc")).toBe(`${window.location.origin}/jobs/abc`);
  });
});

describe("JobQrPrint", () => {
  it("encodes the job's own page in the QR", async () => {
    show();
    const img = await screen.findByRole("img", { name: /^QR:/ });
    expect(img).toHaveAttribute(
      "alt",
      `QR: ${window.location.origin}/jobs/job-abc123`
    );
  });

  it("prints the URL as text as well, so a bad scan is not a dead end", () => {
    show();
    expect(
      screen.getByText(`${window.location.origin}/jobs/job-abc123`)
    ).toBeInTheDocument();
  });

  it("identifies the job in words, not only in the code", () => {
    show();
    expect(screen.getByText("JOB-42")).toBeInTheDocument();
    expect(screen.getByText("Anand Garments")).toBeInTheDocument();
    expect(screen.getByText("#77")).toBeInTheDocument();
  });

  it("names the machine and its head count", () => {
    show();
    expect(screen.getByText("LOOM-07 · 4 heads")).toBeInTheDocument();
  });

  it("says so plainly when no machine is assigned", () => {
    // A blank here reads as a printing fault; the docket has to say
    // which it is.
    show(job({ machine: null }));
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
  });

  it("shows planned against produced and packed", () => {
    show();
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["20mm White", "1,200", "800", "500"]);
  });

  it("reports zero rather than blank for an elastic nothing has been made of", () => {
    show(job({ producedElastics: [], packedElastics: [] }));
    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["20mm White", "1,200", "0", "0"]);
  });

  it("says when a job has no elastics rather than printing an empty table", () => {
    show(job({ plannedElastics: [] }));
    expect(screen.getByText(/no elastics planned on this job/i)).toBeInTheDocument();
  });

  it("marks an outsourced job with its vendor", () => {
    show(job({ productionMode: "outsource", outsourceVendor: "Sri Weaving" }));
    expect(screen.getByText("Outsourced — Sri Weaving")).toBeInTheDocument();
  });

  it("renders nothing until it is opened", () => {
    render(<JobQrPrint job={job()} open={false} onClose={() => {}} />);
    expect(screen.queryByText("JOB-42")).not.toBeInTheDocument();
  });
});
