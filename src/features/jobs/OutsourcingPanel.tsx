import { useState } from "react";
import { Truck, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError, httpClient } from "@/core/http/httpClient";
import { OutsourcingRecord, outsourcingBlockers } from "./outsourcing";

// The vendor record for an outsourced job. It takes the place of the
// shift list, because a vendor-made job produces no shifts here — this is
// its production record, and the job cannot move to finishing until the
// reconciliation fields are filled.
//
// Saves progressively: the consignment goes out, then comes back, and the
// planner fills what they know as they know it. What is still outstanding
// is shown rather than blocking the save.

type Draft = Record<string, string>;

const toDraft = (r?: OutsourcingRecord | null): Draft => ({
  qtySentMeters: r?.qtySentMeters != null ? String(r.qtySentMeters) : "",
  qtyReceivedMeters: r?.qtyReceivedMeters != null ? String(r.qtyReceivedMeters) : "",
  efficiencyPct: r?.efficiencyPct != null ? String(r.efficiencyPct) : "",
  actualReturnDate: r?.actualReturnDate ? String(r.actualReturnDate).slice(0, 10) : "",
  notes: r?.notes ?? "",
  dispatchDate: r?.dispatchDate ? String(r.dispatchDate).slice(0, 10) : "",
  expectedReturnDate: r?.expectedReturnDate ? String(r.expectedReturnDate).slice(0, 10) : "",
  rejectedMeters: r?.rejectedMeters != null ? String(r.rejectedMeters) : "",
  ratePerMeter: r?.ratePerMeter != null ? String(r.ratePerMeter) : "",
  outwardChallanNo: r?.outwardChallanNo ?? "",
  inwardChallanNo: r?.inwardChallanNo ?? "",
});

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export function OutsourcingPanel({
  jobId,
  vendor,
  record,
}: {
  jobId: string;
  vendor?: string;
  record?: OutsourcingRecord | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(record));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  // Blockers are computed from what is ON SCREEN, so the list shrinks as
  // the planner types rather than only after a save.
  const blockers = outsourcingBlockers({
    qtySentMeters: numOrNull(draft.qtySentMeters),
    qtyReceivedMeters: numOrNull(draft.qtyReceivedMeters),
    efficiencyPct: numOrNull(draft.efficiencyPct),
    actualReturnDate: draft.actualReturnDate || null,
    notes: draft.notes,
  });

  const save = useMutation({
    mutationFn: () =>
      httpClient.put(`/job/${jobId}/outsourcing`, {
        ...draft,
        qtySentMeters: numOrNull(draft.qtySentMeters),
        qtyReceivedMeters: numOrNull(draft.qtyReceivedMeters),
        efficiencyPct: numOrNull(draft.efficiencyPct),
        rejectedMeters: numOrNull(draft.rejectedMeters),
        ratePerMeter: numOrNull(draft.ratePerMeter),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast("Vendor record saved", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save the vendor record", "error"),
  });

  const d = record?.derived;
  const variance = d?.efficiencyVariancePct;

  return (
    <div className="px-5 pb-5 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="warning">
          <span className="inline-flex items-center gap-1">
            <Truck className="h-3 w-3" />
            Outsourced{vendor ? ` — ${vendor}` : ""}
          </span>
        </StatusChip>
        <span className="text-sm text-ink-400">
          Produced by a vendor, so no shifts run against it here.
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Quantity sent (m) *" type="number" step="0.01" value={draft.qtySentMeters} onChange={set("qtySentMeters")} />
        <Input label="Quantity received (m) *" type="number" step="0.01" value={draft.qtyReceivedMeters} onChange={set("qtyReceivedMeters")} />
        <Input label="Efficiency (%) *" type="number" step="0.1" value={draft.efficiencyPct} onChange={set("efficiencyPct")} />
        <Input label="Dispatch date" type="date" value={draft.dispatchDate} onChange={set("dispatchDate")} />
        <Input label="Expected return" type="date" value={draft.expectedReturnDate} onChange={set("expectedReturnDate")} />
        <Input label="Actual return date *" type="date" value={draft.actualReturnDate} onChange={set("actualReturnDate")} />
        <Input label="Rejected (m)" type="number" step="0.01" value={draft.rejectedMeters} onChange={set("rejectedMeters")} />
        <Input label="Rate (₹/m)" type="number" step="0.01" value={draft.ratePerMeter} onChange={set("ratePerMeter")} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Outward challan" value={draft.outwardChallanNo} onChange={set("outwardChallanNo")} />
          <Input label="Inward challan" value={draft.inwardChallanNo} onChange={set("inwardChallanNo")} />
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="outsourcing-notes" className="mb-1.5 block text-sm font-medium text-ink-600">
          Notes *
        </label>
        <textarea
          id="outsourcing-notes"
          rows={2}
          value={draft.notes}
          onChange={set("notes")}
          placeholder="What came back, any shortfall or quality issue, what was agreed with the vendor"
          className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      {/* Figures the planner reads rather than types. */}
      {d && (d.shortfallMeters !== null || d.jobWorkCost !== null || d.leadTimeDays !== null) && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-ink-100/50 px-3 py-2 text-xs text-ink-600">
          {d.shortfallMeters !== null && <span>Shortfall: <b className="tabular-nums">{d.shortfallMeters.toLocaleString("en-IN")} m</b></span>}
          {d.derivedEfficiencyPct !== null && <span>Implied yield: <b className="tabular-nums">{d.derivedEfficiencyPct}%</b></span>}
          {d.leadTimeDays !== null && <span>Vendor lead time: <b className="tabular-nums">{d.leadTimeDays} d</b></span>}
          {d.jobWorkCost !== null && <span>Job-work cost: <b className="tabular-nums">₹{d.jobWorkCost.toLocaleString("en-IN")}</b></span>}
        </div>
      )}

      {/* A gap between the entered and implied yield is the thing worth
          taking back to the vendor, so it is called out rather than buried. */}
      {variance != null && Math.abs(variance) >= 1 && (
        <p className="mt-2 text-xs text-status-warning">
          Entered efficiency is {Math.abs(variance)}% {variance > 0 ? "above" : "below"} what the
          sent/received figures imply.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-400">
          {blockers.length === 0 ? (
            <span className="text-status-success">Complete — this job can move to finishing.</span>
          ) : (
            <span>Still needed before finishing: {blockers.join("; ")}</span>
          )}
        </div>
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" /> Save vendor record
        </Button>
      </div>
    </div>
  );
}
