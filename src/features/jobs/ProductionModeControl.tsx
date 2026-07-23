import { useEffect, useState } from "react";
import { Factory, Truck, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import { useJobMutations } from "./hooks";

type Mode = "in_house" | "outsource";

// Lets an admin flip a job between in-house and outsourced production
// (with a vendor name), mirroring the Flutter MRP sheet. Hidden on print.
export function ProductionModeControl({
  jobId,
  mode,
  vendor,
}: {
  jobId: string;
  mode: Mode;
  vendor?: string;
}) {
  const { toast } = useToast();
  const { setProductionMode } = useJobMutations();
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorName, setVendorName] = useState(vendor ?? "");
  const isOutsource = mode === "outsource";
  const pending = setProductionMode.isPending;

  useEffect(() => {
    if (vendorOpen) setVendorName(vendor ?? "");
  }, [vendorOpen, vendor]);

  const apply = (nextMode: Mode, nextVendor?: string) =>
    setProductionMode.mutate(
      { jobId, mode: nextMode, vendor: nextVendor },
      {
        onSuccess: () => {
          setVendorOpen(false);
          toast(
            nextMode === "outsource" ? "Job set to outsourced" : "Job set to in-house",
            "success"
          );
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Failed to update production mode", "error"),
      }
    );

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60";

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => { if (isOutsource) apply("in_house"); }}
          aria-pressed={!isOutsource}
          className={cn(
            chipBase,
            !isOutsource
              ? "bg-brand-50 border-brand-500 text-brand-600"
              : "bg-white border-ink-200 text-ink-600 hover:border-ink-400"
          )}
        >
          <Factory className="h-4 w-4" /> In-house
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setVendorOpen(true)}
          aria-pressed={isOutsource}
          className={cn(
            chipBase,
            isOutsource
              ? "bg-status-warningBg border-status-warning text-status-warning"
              : "bg-white border-ink-200 text-ink-600 hover:border-ink-400"
          )}
        >
          <Truck className="h-4 w-4" /> Outsource
        </button>

        {isOutsource && (
          <button
            type="button"
            onClick={() => setVendorOpen(true)}
            className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900"
          >
            <Pencil className="h-3.5 w-3.5" />
            {vendor ? `Vendor: ${vendor}` : "No vendor set"}
          </button>
        )}
      </div>

      <Modal
        open={vendorOpen}
        onClose={() => setVendorOpen(false)}
        title="Outsource to vendor"
        width="max-w-sm"
      >
        <div className="space-y-4">
          <Input
            label="Vendor / subcontractor name"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="e.g. Sri Sakthi Weaving"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVendorOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={pending}
              onClick={() => apply("outsource", vendorName.trim())}
            >
              Set outsource
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
