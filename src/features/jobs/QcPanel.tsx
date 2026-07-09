import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus, Trash2, FileBadge } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError, httpClient } from "@/core/http/httpClient";
import { PrintModal } from "@/components/print/PrintModal";
import { JobDetail } from "./types";

interface QcResult {
  parameter: string;
  expected: string;
  measured: string;
  pass: boolean;
}
interface QcRecordRow {
  _id: string;
  elastic?: { _id: string; name: string } | null;
  checkedBy?: { name?: string } | null;
  results: QcResult[];
  overallResult: "pass" | "fail";
  defectCode?: string;
  rejectedMeters?: number;
  notes?: string;
  createdAt?: string;
}
interface CoaData {
  jobOrderNo: number;
  orderNo?: number | null;
  customerPo?: string;
  customerName: string;
  items: Array<{
    elasticName: string;
    checkedBy: string;
    checkedAt?: string;
    results: QcResult[];
  }>;
}

const qcService = {
  byJob: async (jobId: string) =>
    (await httpClient.get<{ success: boolean; records: QcRecordRow[] }>("/qc/by-job", { jobId }))
      .records,
  coa: async (jobId: string) =>
    (await httpClient.get<{ success: boolean; coa: CoaData }>("/qc/coa", { jobId })).coa,
  create: (body: unknown) => httpClient.post("/qc/create", body),
};

function QcForm({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [elasticId, setElasticId] = useState("");
  const [rows, setRows] = useState<QcResult[]>([
    { parameter: "", expected: "", measured: "", pass: true },
  ]);
  const [defectCode, setDefectCode] = useState("");
  const [rejected, setRejected] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      qcService.create({
        jobId: job.id,
        elasticId,
        results: rows,
        defectCode: defectCode || undefined,
        rejectedMeters: Number(rejected) || 0,
        notes: notes || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qc", job.id] }),
  });

  const valid = elasticId && rows.length > 0 && rows.every((r) => r.parameter && r.measured);
  const anyFail = rows.some((r) => !r.pass);

  const setRow = (i: number, patch: Partial<QcResult>) =>
    setRows((rs) => rs.map((r, x) => (x === i ? { ...r, ...patch } : r)));

  return (
    <Modal open onClose={onClose} title={`QC check — ${job.jobNo}`} width="max-w-xl">
      <div className="space-y-4">
        <Select
          label="Elastic *"
          placeholder="Select elastic"
          options={job.plannedElastics
            .filter((e) => e.elasticId)
            .map((e) => ({ value: e.elasticId!, label: e.elasticName }))}
          value={elasticId}
          onChange={(e) => setElasticId(e.target.value)}
        />
        <div>
          <p className="text-sm font-medium text-ink-600 mb-1.5">Test results *</p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_90px_52px_32px] gap-2 items-center">
                <Input placeholder="Parameter (e.g. Width mm)" value={r.parameter} onChange={(e) => setRow(i, { parameter: e.target.value })} />
                <Input placeholder="Expected" value={r.expected} onChange={(e) => setRow(i, { expected: e.target.value })} />
                <Input placeholder="Measured" value={r.measured} onChange={(e) => setRow(i, { measured: e.target.value })} />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" className="accent-brand-500" checked={r.pass} onChange={(e) => setRow(i, { pass: e.target.checked })} />
                  Pass
                </label>
                <button
                  onClick={() => rows.length > 1 && setRows((rs) => rs.filter((_, x) => x !== i))}
                  className="p-1 rounded text-ink-400 hover:text-status-danger disabled:opacity-40"
                  disabled={rows.length <= 1}
                  aria-label="Remove row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setRows((rs) => [...rs, { parameter: "", expected: "", measured: "", pass: true }])}>
            <Plus className="h-4 w-4" /> Add parameter
          </Button>
        </div>
        {anyFail && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Defect code" placeholder="e.g. WIDTH-OOS" value={defectCode} onChange={(e) => setDefectCode(e.target.value)} />
            <Input label="Rejected meters" type="number" value={rejected} onChange={(e) => setRejected(e.target.value)} />
          </div>
        )}
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            loading={create.isPending}
            onClick={() =>
              create.mutate(undefined, {
                onSuccess: () => {
                  toast(anyFail ? "QC recorded — FAIL" : "QC recorded — PASS", anyFail ? "error" : "success");
                  onClose();
                },
                onError: (e) => toast(e instanceof ApiError ? e.message : "QC save failed", "error"),
              })
            }
          >
            Save QC result
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CoaSheet({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["qc", jobId, "coa"], queryFn: () => qcService.coa(jobId) });
  return (
    <PrintModal open onClose={onClose} title="Certificate of analysis">
      {data && (
        <div className="text-ink-900">
          <div className="text-center border-b-2 border-ink-900 pb-3">
            <h1 className="text-xl font-bold">CERTIFICATE OF ANALYSIS</h1>
            <p className="text-sm mt-1">
              Job J-{data.jobOrderNo}
              {data.orderNo ? ` · Order #${data.orderNo}` : ""}
              {data.customerPo ? ` · PO ${data.customerPo}` : ""} · {data.customerName}
            </p>
          </div>
          {data.items.length === 0 && (
            <p className="mt-4 text-sm text-ink-600">No passing QC records yet for this job.</p>
          )}
          {data.items.map((item, i) => (
            <div key={i} className="mt-4 print-label">
              <h2 className="text-sm font-bold">{item.elasticName}</h2>
              <table className="mt-1 w-full text-sm border border-ink-200">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-100/50 text-left">
                    <th className="py-1.5 px-2">Parameter</th>
                    <th className="py-1.5 px-2">Specified</th>
                    <th className="py-1.5 px-2">Measured</th>
                    <th className="py-1.5 px-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {item.results.map((r, x) => (
                    <tr key={x} className="border-b border-ink-100">
                      <td className="py-1.5 px-2 font-medium">{r.parameter}</td>
                      <td className="py-1.5 px-2">{r.expected || "—"}</td>
                      <td className="py-1.5 px-2">{r.measured}</td>
                      <td className="py-1.5 px-2">{r.pass ? "PASS" : "FAIL"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-ink-600">
                Checked by {item.checkedBy || "—"}
                {item.checkedAt && ` on ${new Date(item.checkedAt).toLocaleDateString()}`}
              </p>
            </div>
          ))}
          <div className="mt-10 text-sm border-t border-ink-400 pt-1 w-56 ml-auto text-right">
            Authorised signatory
          </div>
        </div>
      )}
    </PrintModal>
  );
}

export function QcPanel({ job }: { job: JobDetail }) {
  const [formOpen, setFormOpen] = useState(false);
  const [coaOpen, setCoaOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["qc", job.id],
    queryFn: () => qcService.byJob(job.id),
  });

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-brand-500" /> Quality control
        </h3>
        <span className="ml-auto flex gap-2">
          {(data?.length ?? 0) > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setCoaOpen(true)}>
              <FileBadge className="h-4 w-4" /> COA
            </Button>
          )}
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Record QC
          </Button>
        </span>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <p className="mt-3 text-sm text-ink-400">
          No QC results yet — record measured values against the elastic's test parameters.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {data!.map((r) => (
            <li key={r._id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.elastic?.name ?? "—"}</p>
                <p className="text-xs text-ink-400">
                  {r.results.length} parameters
                  {r.checkedBy?.name && ` · ${r.checkedBy.name}`}
                  {r.createdAt && ` · ${new Date(r.createdAt).toLocaleDateString()}`}
                  {r.defectCode && ` · ${r.defectCode}`}
                  {(r.rejectedMeters ?? 0) > 0 && ` · ${r.rejectedMeters}m rejected`}
                </p>
              </div>
              <StatusChip tone={r.overallResult === "pass" ? "success" : "danger"}>
                {r.overallResult}
              </StatusChip>
            </li>
          ))}
        </ul>
      )}

      {formOpen && <QcForm job={job} onClose={() => setFormOpen(false)} />}
      {coaOpen && <CoaSheet jobId={job.id} onClose={() => setCoaOpen(false)} />}
    </Card>
  );
}
