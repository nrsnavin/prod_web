import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { todayYmd } from "@/core/format/date";
import { saveBlob } from "@/features/elastics/ElasticBulkActions";
import { orderService } from "./api";

/**
 * Every order still in hand (Open, Approved, In progress) as an Excel
 * file: the customer and the first few elastics, one row per order.
 * Whatever the list's filter shows — it is the whole open book.
 */
export function ExportOpenOrders() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      saveBlob(await orderService.exportOpen(), `open-orders-${todayYmd()}.xlsx`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not export the open orders", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="secondary" loading={busy} onClick={run}>
      <FileSpreadsheet className="h-4 w-4" /> Export open orders
    </Button>
  );
}
