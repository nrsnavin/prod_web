import { useMemo, useRef, useState } from "react";
import {
  Plus, Sparkles, Upload, CheckCircle2, XCircle, Loader2, Camera, ShieldCheck,
  BrainCircuit, Download, Lock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useQcJobs, useQcRecent, useQcMutations, useTrainingReadiness } from "./hooks";
import { qcService } from "./api";
import { QcElasticRef, QcJob, QcResultRow } from "./types";

function elasticOf(l: QcJob["elastics"][number]): QcElasticRef | null {
  return typeof l.elastic === "object" && l.elastic ? (l.elastic as QcElasticRef) : null;
}

function specRows(el: QcElasticRef | null): QcResultRow[] {
  const tp = (el?.testingParameters ?? {}) as Record<string, unknown>;
  const rows: QcResultRow[] = [];
  const push = (parameter: string, v: unknown) =>
    v != null && typeof v !== "object" && rows.push({ parameter, expected: String(v), measured: "", pass: true });
  push("Width (mm)", tp.width);
  push("Elongation (%)", tp.elongation);
  for (const [k, v] of Object.entries(tp)) {
    if (["width", "elongation"].includes(k)) continue;
    push(k, v);
  }
  return rows;
}

function NewQcModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const jobs = useQcJobs();
  const { visionDraft, create } = useQcMutations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [jobId, setJobId] = useState("");
  const [elasticId, setElasticId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [results, setResults] = useState<QcResultRow[]>([]);
  const [defectCode, setDefectCode] = useState("");
  const [rejectedMeters, setRejectedMeters] = useState("0");
  const [notes, setNotes] = useState("");

  const job = (jobs.data ?? []).find((j) => j._id === jobId);
  const elasticOptions = (job?.elastics ?? [])
    .map((l) => elasticOf(l))
    .filter((e): e is QcElasticRef => !!e)
    .map((e) => ({ value: e._id, label: e.name }));
  const overall: "pass" | "fail" = results.length > 0 && results.every((r) => r.pass) ? "pass" : results.length === 0 ? "pass" : "fail";

  const onElastic = (id: string) => {
    setElasticId(id);
    const el = (job?.elastics ?? []).map(elasticOf).find((e) => e?._id === id) ?? null;
    setResults(specRows(el));
    setConfidence(null); setAiAssisted(false); setDefectCode(""); setNotes("");
  };

  const onFile = (f: File | null) => {
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setImageUrl(String(reader.result));
      reader.readAsDataURL(f);
    } else setImageUrl("");
  };

  const analyze = () => {
    if (!elasticId || !file) { toast("Pick an elastic and a photo first", "error"); return; }
    visionDraft.mutate(
      { elasticId, file },
      {
        onSuccess: (res) => {
          if (!res.available) { toast(res.message || "AI vision not configured", "info"); return; }
          if (!res.ok || !res.draft) { toast(res.message || "Couldn't read the image — fill it manually", "info"); return; }
          const d = res.draft;
          setResults(d.results.length > 0 ? d.results : results);
          setDefectCode(d.defectCode);
          setRejectedMeters(String(d.rejectedMetersHint || 0));
          setNotes(d.notes);
          setConfidence(d.confidence);
          setAiAssisted(true);
          if (res.image) setImageUrl(res.image);
          toast("AI draft ready — review and adjust", "success");
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Analysis failed", "error"),
      }
    );
  };

  const setRow = (i: number, patch: Partial<QcResultRow>) =>
    setResults((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = () => {
    if (!jobId || !elasticId) { toast("Select a job and elastic", "error"); return; }
    if (results.length === 0 || results.some((r) => !r.measured.trim())) {
      toast("Every parameter needs a measured value", "error"); return;
    }
    create.mutate(
      {
        jobId, elasticId, results,
        defectCode: overall === "fail" ? defectCode : "",
        rejectedMeters: Number(rejectedMeters) || 0,
        notes, image: imageUrl, aiAssisted,
      },
      {
        onSuccess: () => { toast("QC check saved", "success"); onClose(); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Save failed", "error"),
      }
    );
  };

  return (
    <FormScreen open onClose={onClose} title="New QC check" width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Combobox
            label="Job *"
            placeholder={jobs.isLoading ? "Loading…" : "Select job"}
            options={(jobs.data ?? []).map((j) => ({
              value: j._id,
              label: `J-${j.jobOrderNo}${j.customer?.name ? ` — ${j.customer.name}` : ""} (${j.status})`,
            }))}
            value={jobId}
            onChange={(v) => { setJobId(v); setElasticId(""); setResults([]); }}
          />
          <Combobox
            label="Elastic *"
            placeholder="Select elastic"
            options={elasticOptions}
            value={elasticId}
            onChange={onElastic}
          />
        </div>

        {/* Photo + AI analyze */}
        <div className="rounded-lg border border-ink-200 p-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-20 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-ink-200 bg-canvas text-ink-400"
              onClick={() => fileRef.current?.click()}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="sample" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> {imageUrl ? "Change photo" : "Add photo"}
                </Button>
                <Button
                  size="sm"
                  onClick={analyze}
                  disabled={!elasticId || !file || visionDraft.isPending}
                >
                  {visionDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Analyze with AI
                </Button>
                {confidence != null && (
                  <StatusChip tone={confidence >= 70 ? "success" : confidence >= 40 ? "warning" : "danger"}>
                    {confidence}% confidence
                  </StatusChip>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-400">
                AI flags visible defects and pre-fills the check. You verify every value before saving.
              </p>
            </div>
          </div>
        </div>

        {/* Results table */}
        {results.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-ink-600">Parameters</p>
              <StatusChip tone={overall === "pass" ? "success" : "danger"}>
                {overall === "pass" ? "PASS" : "FAIL"}
              </StatusChip>
            </div>
            <div className="hidden grid-cols-[1fr_90px_1fr_70px] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
              <span>Parameter</span><span>Expected</span><span>Measured</span><span className="text-center">Pass</span>
            </div>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_1fr_70px] items-center gap-2">
                  <span className="truncate text-sm">{r.parameter}</span>
                  <span className="text-sm text-ink-400">{r.expected || "—"}</span>
                  <Input value={r.measured} onChange={(e) => setRow(i, { measured: e.target.value })} placeholder="value" />
                  <button
                    type="button"
                    onClick={() => setRow(i, { pass: !r.pass })}
                    className={cn(
                      "grid h-9 place-items-center rounded-lg",
                      r.pass ? "bg-status-successBg text-status-success" : "bg-status-dangerBg text-status-danger"
                    )}
                    aria-label="Toggle pass"
                  >
                    {r.pass ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {overall === "fail" && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Defect code" placeholder="e.g. weave-fault" value={defectCode} onChange={(e) => setDefectCode(e.target.value)} />
            <Input label="Rejected (m)" type="number" step="0.01" value={rejectedMeters} onChange={(e) => setRejectedMeters(e.target.value)} />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={create.isPending} onClick={save}>Save QC check</Button>
        </div>
      </div>
    </FormScreen>
  );
}

function DefectModelCard() {
  const { data } = useTrainingReadiness();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  if (!data) return null;
  const t = data.totals;

  const exportSet = async () => {
    setExporting(true);
    try {
      const res = await qcService.exportDataset();
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `qc-defect-dataset-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast(`Exported ${res.count} labelled samples`, "success");
    } catch {
      toast("Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="mb-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <BrainCircuit className="h-4 w-4 text-brand-500" /> Defect model
            {data.ready ? (
              <StatusChip tone="success">Ready to train</StatusChip>
            ) : (
              <StatusChip tone="neutral"><Lock className="mr-1 h-3 w-3" /> Collecting data</StatusChip>
            )}
          </h3>
          <p className="mt-1 max-w-xl text-sm text-ink-400">{data.recommendation}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportSet}
          loading={exporting}
          disabled={t.labelledImages === 0}
        >
          <Download className="h-4 w-4" /> Export training set
        </Button>
      </div>

      {/* Progress toward the fine-tune threshold */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-ink-400">
          <span>{t.labelledImages} labelled photos</span>
          <span>{data.progressPct}% of {data.thresholds.MIN_SAMPLES} target</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
          <span
            className={cn("block h-full rounded-full", data.ready ? "bg-status-success" : "bg-brand-500")}
            style={{ width: `${data.progressPct}%` }}
          />
        </div>
      </div>

      {/* Class distribution */}
      {data.classes.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Label classes ({data.classesReady}/{data.thresholds.MIN_CLASSES} ready · ≥{data.thresholds.MIN_PER_CLASS} each)
          </p>
          <ul className="space-y-1.5">
            {data.classes.slice(0, 6).map((c) => {
              const pct = Math.min(100, Math.round((c.count / data.thresholds.MIN_PER_CLASS) * 100));
              const ok = c.count >= data.thresholds.MIN_PER_CLASS;
              return (
                <li key={c.defectCode} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate">{c.defectCode}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span className={cn("block h-full rounded-full", ok ? "bg-status-success" : "bg-status-warning")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-ink-500">{c.count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
        <Sparkles className="h-3 w-3" /> {t.aiAssistedShare}% of these were AI-assisted then verified by an inspector — the corrections are the training signal.
      </p>
    </Card>
  );
}

export function QcPage() {
  const recent = useQcRecent();
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const rows = recent.data ?? [];
    const fails = rows.filter((r) => r.overallResult === "fail").length;
    const aid = rows.filter((r) => r.aiAssisted).length;
    return { total: rows.length, fails, aiAssisted: aid };
  }, [recent.data]);

  return (
    <>
      <PageHeader
        title="Quality Control"
        subtitle="AI-assisted defect capture at the checking stage. Snap a photo, verify, save."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New QC check
          </Button>
        }
      />

      <DefectModelCard />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-ink-400">Recent checks</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-400">Failed</p>
          <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", stats.fails > 0 ? "text-status-danger" : "text-status-success")}>{stats.fails}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs text-ink-400"><Sparkles className="h-3 w-3" /> AI-assisted</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums">{stats.aiAssisted}</p>
        </Card>
      </div>

      {recent.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (recent.data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No QC checks yet" description="Record your first inspection to build the quality record." />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {recent.data!.map((r) => (
              <li key={r._id} className="flex items-center gap-3 px-4 py-3 text-sm">
                {r.overallResult === "pass" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-status-success" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-status-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {r.elastic?.name ?? "—"}
                    {r.aiAssisted && (
                      <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-600">
                        <Sparkles className="h-3 w-3" /> AI
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-400">
                    J-{r.job?.jobOrderNo ?? "—"}
                    {r.job?.customer?.name ? ` · ${r.job.customer.name}` : ""}
                    {r.defectCode ? ` · ${r.defectCode}` : ""}
                    {r.rejectedMeters > 0 ? ` · ${r.rejectedMeters} m rejected` : ""}
                  </p>
                </div>
                <span className="text-xs text-ink-400">{new Date(r.createdAt).toLocaleDateString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {open && <NewQcModal onClose={() => setOpen(false)} />}
    </>
  );
}
