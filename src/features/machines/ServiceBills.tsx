import { useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormScreen } from "@/components/ui/FormScreen";
import { StatusChip } from "@/components/ui/StatusChip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { machineService } from "./api";
import { useMachineMutations } from "./hooks";
import { ServiceBill, ServiceBillKind } from "./types";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const KIND_LABEL: Record<ServiceBillKind, string> = {
  service_bill: "Service bill",
  spare_bill: "Spare bill",
};

// Mirrors ALLOWED_CONTENT_TYPES on the server; the picker filters to the
// same set so a rejected upload is the exception, not the norm.
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const MAX_MB = 5;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Opens a bill in a new tab. Fetched as a blob so the auth cookie applies. */
async function openBill(bill: ServiceBill, onError: (msg: string) => void) {
  try {
    const blob = await machineService.serviceBillFile(bill._id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    // The tab keeps its own reference; release ours once it has loaded.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    onError(e instanceof ApiError ? e.message : "Couldn't open the bill");
  }
}

function UploadDialog({
  machineId,
  serviceLogId,
  onClose,
}: {
  machineId: string;
  serviceLogId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { uploadServiceBill } = useMachineMutations();

  const [kind, setKind] = useState<ServiceBillKind>("service_bill");
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState("");
  const [partName, setPartName] = useState("");
  const [fileError, setFileError] = useState("");

  const pick = (f: File | null) => {
    if (f && f.size > MAX_MB * 1024 * 1024) {
      setFileError(`That file is ${fmtSize(f.size)} — the limit is ${MAX_MB} MB.`);
      setFile(null);
      return;
    }
    setFileError("");
    setFile(f);
  };

  const submit = () => {
    if (!file) {
      setFileError("Choose the bill to attach.");
      return;
    }
    uploadServiceBill.mutate(
      {
        machineId,
        serviceLogId,
        kind,
        file,
        amount: amount ? Number(amount) : undefined,
        vendor: vendor || undefined,
        billNo: billNo || undefined,
        billDate: billDate || undefined,
        partName: partName || undefined,
      },
      {
        onSuccess: () => {
          toast(`${KIND_LABEL[kind]} attached`, "success");
          onClose();
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Upload failed", "error"),
      }
    );
  };

  return (
    <FormScreen open onClose={onClose} title="Attach a bill">
      <div className="space-y-4">
        <Select
          label="Bill type *"
          value={kind}
          onChange={(e) => setKind(e.target.value as ServiceBillKind)}
          options={[
            { value: "service_bill", label: "Service bill (labour / workshop)" },
            { value: "spare_bill", label: "Spare bill (parts)" },
          ]}
        />

        <div className="space-y-1.5">
          <label htmlFor="bill-file" className="block text-sm font-medium text-ink-600">
            File *
          </label>
          <input
            id="bill-file"
            type="file"
            accept={ACCEPT}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-ink-200 bg-surface p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-900"
          />
          {fileError ? (
            <p className="text-xs text-status-danger">{fileError}</p>
          ) : (
            <p className="text-xs text-ink-400">
              A photo of the bill or the vendor's PDF, up to {MAX_MB} MB.
            </p>
          )}
        </div>

        {kind === "spare_bill" && (
          <Input
            label="Part fitted"
            placeholder="e.g. Drive belt A-42"
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Amount (₹)"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint="Totalled against the log's cost"
          />
          <Input
            label="Vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
          <Input label="Bill no." value={billNo} onChange={(e) => setBillNo(e.target.value)} />
          <Input
            label="Bill date"
            type="date"
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={uploadServiceBill.isPending} onClick={submit}>
            <Upload className="h-4 w-4" /> Upload bill
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}

/**
 * The bills filed against one service log: what was paid, to whom, and the
 * scan itself. Shown inline under the log so the paperwork lives with the
 * job it belongs to rather than in a separate filing screen.
 */
export function ServiceBills({
  machineId,
  serviceLogId,
  bills,
  loading,
}: {
  machineId: string;
  serviceLogId: string;
  bills: ServiceBill[];
  loading: boolean;
}) {
  const { toast } = useToast();
  const { deleteServiceBill } = useMachineMutations();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ServiceBill | null>(null);

  const total = bills.reduce((sum, b) => sum + (b.amount || 0), 0);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setUploadOpen(true)}>
          <Paperclip className="h-3.5 w-3.5" /> Attach bill
        </Button>
        {total > 0 && (
          <span className="text-xs text-ink-400">
            Bills total <span className="font-medium text-ink-600">{inr(total)}</span>
          </span>
        )}
        {loading && bills.length === 0 && (
          <span className="text-xs text-ink-400">Loading bills…</span>
        )}
      </div>

      {bills.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {bills.map((b) => {
            const Icon = b.contentType === "application/pdf" ? FileText : ImageIcon;
            return (
              <li
                key={b._id}
                className="flex items-center gap-2 rounded-lg border border-ink-200 bg-surface-muted px-2.5 py-1.5"
              >
                <Icon className="h-4 w-4 shrink-0 text-ink-400" />
                <button
                  onClick={() => openBill(b, (m) => toast(m, "error"))}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium text-brand-600 hover:underline">
                    {b.filename || "Bill"}
                  </span>
                  <span className="block truncate text-xs text-ink-400">
                    {[
                      b.partName,
                      b.vendor,
                      b.billNo && `#${b.billNo}`,
                      fmtSize(b.size),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                <StatusChip tone={b.kind === "spare_bill" ? "info" : "neutral"}>
                  {b.kind === "spare_bill" ? "spare" : "service"}
                </StatusChip>
                {b.amount > 0 && (
                  <span className="text-sm font-semibold tabular-nums">{inr(b.amount)}</span>
                )}
                <button
                  onClick={() => setPendingDelete(b)}
                  className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-status-danger"
                  aria-label={`Remove ${b.filename || "bill"}`}
                  title="Remove bill"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {uploadOpen && (
        <UploadDialog
          machineId={machineId}
          serviceLogId={serviceLogId}
          onClose={() => setUploadOpen(false)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this bill?"
        message={`"${pendingDelete?.filename || "This bill"}" will be deleted. The service log itself stays.`}
        confirmLabel="Remove"
        danger
        loading={deleteServiceBill.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() =>
          pendingDelete &&
          deleteServiceBill.mutate(pendingDelete._id, {
            onSuccess: () => {
              toast("Bill removed", "success");
              setPendingDelete(null);
            },
            onError: (e) =>
              toast(e instanceof ApiError ? e.message : "Couldn't remove the bill", "error"),
          })
        }
      />
    </div>
  );
}
