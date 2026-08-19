import { PrintModal } from "@/components/print/PrintModal";
import { QrImg } from "@/components/print/QrImg";
import { SheetHeader, SheetSection, SheetTable, Th, Td } from "@/components/print/SheetForm";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A JOB CARD THAT CAN BE SCANNED BACK
//
//  Printed and taped to the travelling docket, so anybody holding the
//  paper can get to the job on their phone instead of reading a number
//  off it and typing it into a search box.
//
//  ── Why the QR holds a URL and not an id ─────────────────────────
//  The other QR codes in this system encode tagged strings — `BOX|<id>`
//  on a packing slip, `COVB|J:12|C:…|B:3` on a covering label. Those
//  assume a scanner that knows the format, and there isn't one: neither
//  mobile app has a scanner, in either repo. Every QR printed here so
//  far has been unreadable by anything, which is presumably why nobody
//  has ever asked about them.
//
//  A URL needs no scanner. Every phone camera made in the last decade
//  opens one from the lock screen. So this encodes the job's own page
//  on whatever host the sheet was printed from — print from the office
//  machine and it points at the office host; print from the public one
//  and it points there. Nothing to configure and nothing to keep in
//  step with a deployment.
//
//  ── The paper still has to work on its own ───────────────────────
//  A QR is a single point of failure: a smudged label, a phone with a
//  flat battery, a scanner that will not focus in mill light. So the
//  job number, customer, machine and the planned quantities are all
//  printed in full beside it. The QR is a shortcut, never the only copy
//  of the information.
// ══════════════════════════════════════════════════════════════════

/**
 * The page this job lives on, on the host the sheet is being printed
 * from.
 *
 * Read off `window.location` rather than from config: the app is served
 * from more than one host (dev, the LAN box, the public domain) and a
 * baked-in URL would send somebody scanning in the mill to a machine
 * they cannot reach.
 */
export function jobUrl(jobId: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  return `${origin}/jobs/${jobId}`;
}

const fmtQty = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("en-IN") : "—";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN") : "—";

export function JobQrPrint({
  job, open, onClose,
}: { job: JobDetail; open: boolean; onClose: () => void }) {
  // Nothing is built while the sheet is closed. PrintModal returns null
  // when `open` is false, but its CHILDREN are evaluated before it gets
  // to decide that — so without this early return the whole sheet is
  // constructed on every render of the job page, and any fault in it
  // takes the page down rather than the print preview. That is not
  // hypothetical: the existing job-detail tests caught exactly this.
  if (!open) return null;

  const url = jobUrl(job.id);

  // Real responses do omit these. Defaulting here rather than trusting
  // the type keeps a missing array a missing row instead of a blank
  // page — the job card is printed precisely when somebody needs the
  // job, so failing closed is the wrong direction.
  const planned = job.plannedElastics ?? [];
  const produced = job.producedElastics ?? [];
  const packed = job.packedElastics ?? [];

  return (
    <PrintModal open={open} onClose={onClose} title={`Job card — ${job.jobNo}`}>
      <div>
        <SheetHeader
          title="Job Card"
          subtitle={job.jobNo}
          fields={[
            { label: "Customer", value: job.customerName },
            { label: "Order", value: job.orderNo ? `#${job.orderNo}` : "—" },
            { label: "Status", value: job.status },
            { label: "Date", value: fmtDate(job.date) },
          ]}
        />

        <SheetSection>Job</SheetSection>
        <div className="border border-ink-300 p-3">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-ink-500">Machine</dt>
                <dd className="font-medium">
                  {job.machine
                    ? `${job.machine.machineName} · ${job.machine.machineNoOfHead} heads`
                    : "Not assigned"}
                </dd>
                <dt className="text-ink-500">Made</dt>
                <dd className="font-medium">
                  {job.productionMode === "outsource"
                    ? `Outsourced${job.outsourceVendor ? ` — ${job.outsourceVendor}` : ""}`
                    : "In house"}
                </dd>
                <dt className="text-ink-500">Warping</dt>
                <dd className="font-medium">{job.warping?.status ?? "—"}</dd>
                <dt className="text-ink-500">Covering</dt>
                <dd className="font-medium">{job.covering?.status ?? "—"}</dd>
              </dl>
            </div>

            {/* Bigger than the label QRs: this one is read off a docket
                pinned to a machine in mill light, not off a box held in
                the hand. */}
            <div className="shrink-0 text-center">
              <QrImg value={url} size={120} />
              <p className="mt-1 text-[10px] text-ink-500">Scan for this job</p>
            </div>
          </div>
        </div>

        <SheetSection>Elastics</SheetSection>
        <SheetTable
            head={
              <tr>
                <Th>Elastic</Th>
                <Th align="right">Planned</Th>
                <Th align="right">Produced</Th>
                <Th align="right">Packed</Th>
              </tr>
            }
          >
            <tbody>
              {planned.length === 0 ? (
                <tr>
                  <Td colSpan={4}>No elastics planned on this job.</Td>
                </tr>
              ) : (
                planned.map((p) => {
                  const made = produced.find((x) => x.elasticName === p.elasticName);
                  const inBox = packed.find((x) => x.elasticName === p.elasticName);
                  return (
                    <tr key={p.elasticName}>
                      <Td>{p.elasticName}</Td>
                      <Td align="right">{fmtQty(p.quantity)}</Td>
                      <Td align="right">{fmtQty(made?.quantity ?? 0)}</Td>
                      <Td align="right">{fmtQty(inBox?.quantity ?? 0)}</Td>
                    </tr>
                  );
                })
              )}
            </tbody>
        </SheetTable>

        {/* The URL in plain text under the code. A QR that will not scan
            is then still a thing somebody can type, and it makes what
            the code contains obvious rather than something to be
            trusted. */}
        <p className="mt-3 break-all text-center text-[10px] text-ink-400">{url}</p>
      </div>
    </PrintModal>
  );
}

export default JobQrPrint;
