import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SelectionBar } from "@/components/ui/SelectionBar";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { downloadCsv, toCsv } from "@/core/format/csv";
import { saveBlob } from "@/features/elastics/ElasticBulkActions";
import { orderService } from "./api";
import { OrderListItem } from "./types";
import { orderStatusLabel } from "./orderStatus";

// ══════════════════════════════════════════════════════════════════
//  ACTING ON THE ORDERS TICKED IN THE LIST
//
//  Print their status reports as one PDF, or export. An order is
//  dispatched and delivered through its challans, so those moves are on
//  the challan list, not here.
// ══════════════════════════════════════════════════════════════════

/** The server merges at most this many reports into one PDF. */
export const MAX_ORDER_PRINT = 50;

export function ordersCsv(rows: OrderListItem[]): string {
  return toCsv(
    ["Order #", "Customer", "Customer PO", "Order date", "Supply by", "Status"],
    rows.map((o) => [
      o.orderNo, o.customer?.name ?? "", o.po ?? "", o.date ? o.date.slice(0, 10) : "",
      o.supplyDate ? o.supplyDate.slice(0, 10) : "", orderStatusLabel[o.status] ?? o.status,
    ])
  );
}

export function OrderBulkActions({ selected, onClear }: { selected: OrderListItem[]; onClear: () => void }) {
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);
  const tooMany = selected.length > MAX_ORDER_PRINT;

  const print = async () => {
    setPrinting(true);
    try {
      saveBlob(
        await orderService.statusReportsPdf(selected.map((o) => o._id)),
        `order-status-${new Date().toISOString().slice(0, 10)}.pdf`
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not make the PDF", "error");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SelectionBar count={selected.length} label="Actions on the selected orders" onClear={onClear}>
      <Button size="sm" variant="secondary" loading={printing} disabled={tooMany} onClick={print}
        title={tooMany ? `Print up to ${MAX_ORDER_PRINT} at a time` : undefined}>
        <Printer className="h-4 w-4" /> Print status reports
      </Button>
      <Button size="sm" variant="ghost"
        onClick={() => downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, ordersCsv(selected))}>
        <Download className="h-4 w-4" /> Export CSV
      </Button>
    </SelectionBar>
  );
}
