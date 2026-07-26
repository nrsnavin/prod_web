import { useRef, useState } from "react";
import { UploadCloud, FileText, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { cn } from "@/components/ui/cn";
import { sheetService, IngestResult, IngestMatchedRow } from "./sheet";

type EditRow = IngestMatchedRow & { include: boolean };

export function SheetUploadModal({
  planId,
  open,
  onClose,
  onApplied,
}: {
  planId: string;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [applying, setApplying] = useState(false);

  const reset = () => {
    setFile(null);
    setResult(null);
    setRows([]);
    setIngesting(false);
    setApplying(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const runOcr = async () => {
    if (!file) return;
    setIngesting(true);
    try {
      const res = await sheetService.ingest(planId, file);
      setResult(res);
      setRows(
        res.matched.map((m) => ({ ...m, include: !m.alreadyClosed && m.production != null }))
      );
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.status === 503
            ? "OCR isn't configured on the server (ANTHROPIC_API_KEY missing)."
            : e.message
          : "Couldn't read the sheet.";
      toast(msg, "error");
    } finally {
      setIngesting(false);
    }
  };

  const patch = (i: number, p: Partial<EditRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const apply = async () => {
    const entries = rows
      .filter((r) => r.include && !r.alreadyClosed && r.production != null && r.production >= 0)
      .map((r) => ({
        id: r.shiftDetailId,
        production: r.production as number,
        timer: r.timer || undefined,
        feedback: r.remarks || undefined,
      }));
    if (entries.length === 0) {
      toast("Nothing selected to apply.", "error");
      return;
    }
    setApplying(true);
    try {
      const res = await sheetService.applyBulk(entries);
      toast(`${res.saved} shift${res.saved === 1 ? "" : "s"} sent for verification`, "success");
      onApplied();
      close();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Failed to apply", "error");
    } finally {
      setApplying(false);
    }
  };

  const selectedCount = rows.filter((r) => r.include && !r.alreadyClosed && r.production != null).length;

  return (
    <FormScreen open={open} onClose={close} title="Upload filled production sheet" width="max-w-5xl">
      {!result ? (
        <div className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 bg-canvas py-10 text-center hover:border-brand-500"
          >
            <UploadCloud className="h-8 w-8 text-ink-400" />
            {file ? (
              <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                <FileText className="h-4 w-4" /> {file.name}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-ink-900">Choose the scanned PDF</p>
                <p className="text-xs text-ink-400">The filled copy of this plan's production sheet</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-status-infoBg px-3 py-2 text-xs text-status-info">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Claude vision reads the hand-written Production, Timer and Remarks and maps each to its
            machine by the printed row code. You review everything, then it's queued for
            verification — production updates only after you verify each shift, exactly as with
            manual entry.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={runOcr} disabled={!file} loading={ingesting}>
              {ingesting ? "Reading sheet…" : "Read sheet"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusChip tone="success">{result.summary.matched} matched</StatusChip>
            {result.summary.lowConfidence > 0 && (
              <StatusChip tone="warning">{result.summary.lowConfidence} low-confidence</StatusChip>
            )}
            {result.summary.unmatched > 0 && (
              <StatusChip tone="danger">{result.summary.unmatched} unmatched</StatusChip>
            )}
            {result.summary.missing > 0 && (
              <StatusChip tone="neutral">{result.summary.missing} blank</StatusChip>
            )}
            <span className="ml-auto text-xs text-ink-400">
              {result.pages} pages · read by {result.model}
            </span>
          </div>

          {/* Review table */}
          <div className="max-h-[46vh] overflow-auto rounded-lg border border-ink-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-100 text-xs uppercase text-ink-600">
                <tr>
                  <th className="p-2 text-left">✓</th>
                  <th className="p-2 text-left">Machine</th>
                  <th className="p-2 text-left">Operator</th>
                  <th className="p-2 text-left">Job</th>
                  <th className="p-2 text-right">Production (m)</th>
                  <th className="p-2 text-left">Timer</th>
                  <th className="p-2 text-left">Remarks</th>
                  <th className="p-2 text-center">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r, i) => (
                  <tr key={r.shiftDetailId} className={cn(r.alreadyClosed && "opacity-50")}>
                    <td className="p-2">
                      <input aria-label="Include this row"
                        type="checkbox"
                        checked={r.include}
                        disabled={r.alreadyClosed}
                        onChange={(e) => patch(i, { include: e.target.checked })}
                      />
                    </td>
                    <td className="p-2 font-medium">
                      {r.machineID ?? "—"}
                      {r.alreadyClosed && <span className="ml-1 text-xs text-ink-400">(closed)</span>}
                    </td>
                    <td className="p-2 text-ink-600">{r.operator ?? "—"}</td>
                    <td className="p-2 text-ink-600">{r.jobNo ?? "—"}</td>
                    <td className="p-2 text-right">
                      <input aria-label="Production metres"
                        type="number"
                        value={r.production ?? ""}
                        disabled={r.alreadyClosed}
                        onChange={(e) =>
                          patch(i, { production: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        className="w-24 rounded border border-ink-200 px-2 py-1 text-right tabular-nums focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input aria-label="Timer"
                        type="text"
                        value={r.timer ?? ""}
                        disabled={r.alreadyClosed}
                        placeholder="H:MM:SS"
                        onChange={(e) => patch(i, { timer: e.target.value })}
                        className="w-24 rounded border border-ink-200 px-2 py-1 focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input aria-label="Remarks"
                        type="text"
                        value={r.remarks}
                        disabled={r.alreadyClosed}
                        onChange={(e) => patch(i, { remarks: e.target.value })}
                        className="w-full min-w-40 rounded border border-ink-200 px-2 py-1 focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <StatusChip tone={r.confidence >= 0.6 ? "success" : "warning"}>
                        {Math.round(r.confidence * 100)}%
                      </StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.unmatched.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-status-warningBg px-3 py-2 text-xs text-status-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {result.unmatched.length} row(s) couldn't be matched to a machine (unreadable code) and
              were skipped. Re-scan those pages if you need them.
            </div>
          )}

          <p className="text-xs text-ink-400">
            Selected rows are queued in <span className="font-medium text-ink-600">Shift Verification</span>.
            Production is only updated once you verify each shift.
          </p>

          <div className="flex items-center justify-between">
            <button onClick={reset} className="text-sm text-ink-400 hover:text-ink-900">
              ← Upload a different file
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-400">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                {selectedCount} selected
              </span>
              <Button onClick={apply} disabled={selectedCount === 0} loading={applying}>
                Send for verification
              </Button>
            </div>
          </div>
        </div>
      )}
    </FormScreen>
  );
}
