import { useState } from "react";
import { CheckCheck, Download, Printer, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SelectionBar } from "@/components/ui/SelectionBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { downloadCsv, toCsv } from "@/core/format/csv";
import type { BulkResult } from "@/features/elastics/api";
import { ResultDialog, saveBlob } from "@/features/elastics/ElasticBulkActions";
import { dcService } from "./api";
import { useDcMutations } from "./hooks";
import { DeliveryChallan } from "./types";

// ══════════════════════════════════════════════════════════════════
//  ACTING ON THE CHALLANS TICKED IN THE LIST
//
//  Print them as one PDF, mark them dispatched or delivered together,
//  export. Cancelling stays on each challan's own page: it puts stock
//  back, and that is a decision made one challan at a time.
// ══════════════════════════════════════════════════════════════════

export function dcsCsv(rows: DeliveryChallan[]): string {
  return toCsv(
    ["DC number", "Customer", "Order", "Type", "Quantity", "Amount", "Dispatch date", "Vehicle", "Status"],
    rows.map((d) => [
      d.dcNumber, d.customerName, d.orderNo ? `#${d.orderNo}` : "", d.type === "elastic" ? "Elastic" : "Machine part",
      d.totalQuantity ?? "", d.totalAmount ?? "", d.dispatchDate ? d.dispatchDate.slice(0, 10) : "", d.vehicleNo ?? "",
      d.status,
    ])
  );
}

type Move = "dispatched" | "delivered";

export function DcBulkActions({ selected, onClear }: { selected: DeliveryChallan[]; onClear: () => void }) {
  const { toast } = useToast();
  const { bulkStatus } = useDcMutations();
  const [confirm, setConfirm] = useState<Move | null>(null);
  const [result, setResult] = useState<{ title: string; result: BulkResult } | null>(null);
  const [printing, setPrinting] = useState(false);

  // Only those the move applies to are sent: draft → dispatched,
  // dispatched → delivered (the server holds the same rule).
  const drafts = selected.filter((d) => d.status === "draft");
  const dispatched = selected.filter((d) => d.status === "dispatched");
  const targets = confirm === "dispatched" ? drafts : dispatched;

  const move = () => {
    const status = confirm!;
    const title = status === "dispatched" ? "Mark dispatched" : "Mark delivered";
    bulkStatus.mutate(
      { ids: targets.map((d) => d._id), status },
      {
        onSuccess: (r) => {
          setConfirm(null);
          if (r.refused === 0) toast(`${title}: ${r.done} done`, "success");
          else setResult({ title, result: r });
        },
        onError: (e) => {
          setConfirm(null);
          toast(e instanceof ApiError ? e.message : `${title} failed`, "error");
        },
      }
    );
  };

  const print = async () => {
    setPrinting(true);
    try {
      saveBlob(await dcService.bulkPdf(selected.map((d) => d._id)), `challans-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not make the PDF", "error");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      <SelectionBar count={selected.length} label="Actions on the selected challans" onClear={onClear}>
        <Button size="sm" variant="secondary" loading={printing} onClick={print}>
          <Printer className="h-4 w-4" /> Print
        </Button>
        {drafts.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setConfirm("dispatched")}>
            <Truck className="h-4 w-4" /> Mark dispatched ({drafts.length})
          </Button>
        )}
        {dispatched.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setConfirm("delivered")}>
            <CheckCheck className="h-4 w-4" /> Mark delivered ({dispatched.length})
          </Button>
        )}
        <Button size="sm" variant="ghost"
          onClick={() => downloadCsv(`challans-${new Date().toISOString().slice(0, 10)}.csv`, dcsCsv(selected))}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </SelectionBar>

      <ConfirmDialog
        open={!!confirm}
        title={`Mark ${targets.length} challan${targets.length === 1 ? "" : "s"} ${confirm ?? ""}?`}
        message={
          confirm === "dispatched"
            ? `${targets.map((d) => d.dcNumber).join(", ")} leave the draft state and can no longer be edited freely.`
            : `${targets.map((d) => d.dcNumber).join(", ")} are recorded as received by the customer. This cannot be undone.`
        }
        confirmLabel={confirm === "dispatched" ? "Mark dispatched" : "Mark delivered"}
        loading={bulkStatus.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={move}
      />
      {result && <ResultDialog title={result.title} result={result.result} onClose={() => setResult(null)} />}
    </>
  );
}
