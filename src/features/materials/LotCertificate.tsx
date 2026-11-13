import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { PaperChecks, PaperPicker, ReadProblem } from "@/features/accounts/PaperReader";
import { materialService } from "./api";
import { useLotMutations } from "./hooks";
import type { LotCertificate, LotCertificateRead, LotSearchRow, YarnLot } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A YARN LOT'S TEST CERTIFICATE (services/lotCertificates.js)
//
//  The supplier's certificate, photographed or as its PDF, read onto the
//  lot: each property as printed with the range the certificate gives,
//  checked against that range and against the lots of the same yarn
//  before. Kept on the lot, the certified lots of a yarn can be compared
//  side by side and searched by a property ("tenacity 4.5 and over").
// ══════════════════════════════════════════════════════════════════

const outOfSpec = (t: { value: number; min: number | null; max: number | null }) => (t.min !== null && t.value < t.min) || (t.max !== null && t.value > t.max);
const range = (t: { min: number | null; max: number | null }) => (t.min !== null && t.max !== null ? `${t.min}–${t.max}` : t.min !== null ? `≥ ${t.min}` : t.max !== null ? `≤ ${t.max}` : "");

/** Beside the lot's other chips: whether it is certified, and whether anything was out of range. */
export function LotCertificateChip({ lot }: { lot: YarnLot }) {
  const c = lot.certificate;
  if (!c) return null;
  const bad = c.result === "fail" || c.flags.some((f) => f.severity === "danger");
  return <StatusChip tone={bad ? "danger" : "success"}>{bad ? "certificate: out of range" : "certified"}</StatusChip>;
}

/** The button on a lot's row, and the dialog it opens. */
export function LotCertificateButton({ lot }: { lot: YarnLot }) {
  const [open, setOpen] = useState(false);
  const c = lot.certificate;
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Test certificate of lot ${lot.lotNo}`}>
        <FileCheck2 className="h-4 w-4" aria-hidden /> {c ? "Certificate" : "Add certificate"}
      </Button>
      {open && <LotCertificateDialog lot={lot} onClose={() => setOpen(false)} />}
    </>
  );
}

type Row = { key?: string; label: string; value: number | ""; unit: string; min: number | ""; max: number | "" };
const toRow = (t: { key?: string; label: string; value: number; unit: string; min: number | null; max: number | null }): Row => ({ key: t.key, label: t.label, value: t.value, unit: t.unit, min: t.min ?? "", max: t.max ?? "" });

function LotCertificateDialog({ lot, onClose }: { lot: YarnLot; onClose: () => void }) {
  const { toast } = useToast();
  const { saveCertificate } = useLotMutations();
  const kept = lot.certificate ?? null;
  const [mode, setMode] = useState<"view" | "read" | "edit">(kept ? "view" : "read");
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<LotCertificateRead | null>(null);
  const [certNo, setCertNo] = useState("");
  const [date, setDate] = useState("");
  const [issuer, setIssuer] = useState("");
  const [result, setResult] = useState<"" | "pass" | "fail">("");
  const [rows, setRows] = useState<Row[]>([]);

  const startTyping = (from?: LotCertificate | null) => {
    setCertNo(from?.certNo ?? ""); setDate(from?.date ? from.date.slice(0, 10) : ""); setIssuer(from?.issuer ?? ""); setResult(from?.result ?? "");
    setRows(from?.tests.length ? from.tests.map(toRow) : [{ label: "", value: "", unit: "", min: "", max: "" }]);
    setMode("edit");
  };
  const readIt = async (files: File[]) => {
    setBusy(true);
    try {
      const r = await materialService.readLotCertificate(files, lot._id);
      setRead(r);
      if (!r.read.problem) {
        setCertNo(r.read.certNo ?? ""); setDate(r.read.date ?? ""); setIssuer(r.read.issuer ?? ""); setResult(r.read.result ?? "");
        setRows(r.tests.map(toRow));
        setMode("edit");
      }
    } catch (e) { toast(e instanceof Error ? e.message : "Could not read the certificate", "error"); }
    finally { setBusy(false); }
  };
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const ready = rows.some((r) => r.label.trim() && r.value !== "");
  const save = () => saveCertificate.mutate(
    { id: lot._id, body: {
      certNo: certNo.trim() || undefined, date: date || undefined, issuer: issuer.trim() || undefined, result, aiSuggestion: read?.aiSuggestion ?? undefined,
      tests: rows.filter((r) => r.label.trim() && r.value !== "").map((r) => ({ key: r.key, label: r.label.trim(), value: Number(r.value), unit: r.unit.trim(), min: r.min === "" ? null : Number(r.min), max: r.max === "" ? null : Number(r.max) })),
    } },
    {
      onSuccess: (c) => { toast(c.flags.length ? `Kept on lot ${lot.lotNo}: ${c.flags.length} thing${c.flags.length === 1 ? "" : "s"} to look at` : `Certificate kept on lot ${lot.lotNo}`, c.flags.some((f) => f.severity === "danger") ? "info" : "success"); onClose(); },
      onError: (e) => toast(e instanceof ApiError ? e.message : "Could not keep the certificate", "error"),
    }
  );

  return (
    <Modal open onClose={onClose} title={`Test certificate · lot ${lot.lotNo}`} width="max-w-3xl" confirmDirtyClose={false}>
      <div className="space-y-4 text-sm">
        {mode === "view" && kept && (
          <div className="space-y-3" aria-label="The certificate kept">
            <p className="text-ink-600">{kept.issuer || "Issuer not given"}{kept.certNo ? ` · ${kept.certNo}` : ""}{kept.date ? ` · ${formatDate(kept.date)}` : ""}{kept.result ? <> · <StatusChip tone={kept.result === "fail" ? "danger" : "success"}>{kept.result}</StatusChip></> : null}</p>
            <PaperChecks checks={kept.flags} label="Checks when it was kept" />
            <TestsTable tests={kept.tests} />
            <p className="text-xs text-ink-400">Kept{kept.byName ? ` by ${kept.byName}` : ""}{kept.at ? ` on ${formatDate(kept.at)}` : ""}.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => startTyping(kept)}>Correct it</Button>
              <Button onClick={() => { setRead(null); setMode("read"); }}>Read a newer one</Button>
            </div>
          </div>
        )}
        {mode === "read" && (
          <>
            <p className="text-ink-600">The test certificate that came with the lot: a photo or the PDF, up to four pages. Each property is read with the range the certificate gives, and checked against it and against this yarn's lots before.</p>
            <div className="flex flex-wrap items-center gap-2">
              <PaperPicker label="Certificate photo" max={4} busy={busy} onFiles={readIt} />
              <Button type="button" variant="ghost" onClick={() => startTyping(null)}>Type it in instead</Button>
            </div>
            {read?.read.problem && <ReadProblem>{read.read.problem === "not_a_certificate" ? "That does not look like a test certificate." : "The certificate could not be read. Try a sharper photo or the PDF, or type it in."}</ReadProblem>}
          </>
        )}
        {mode === "edit" && (
          <div className="space-y-3" aria-label="The certificate to keep">
            {read && <PaperChecks checks={read.checks} label="Checks on the certificate" />}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input label="Certificate no." value={certNo} onChange={(e) => setCertNo(e.target.value)} />
              <Input label="Dated" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Issued by" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
              <Select label="Result" value={result} onChange={(e) => setResult(e.target.value as "" | "pass" | "fail")} options={[{ value: "", label: "Not stated" }, { value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }]} />
            </div>
            <div className="space-y-2" aria-label="Tests">
              <div aria-hidden className="hidden grid-cols-[minmax(0,1.4fr)_90px_70px_80px_80px_32px] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
                <span>Property</span><span>Value</span><span>Unit</span><span>Min</span><span>Max</span><span />
              </div>
              {rows.map((r, i) => {
                const bad = r.value !== "" && outOfSpec({ value: Number(r.value), min: r.min === "" ? null : Number(r.min), max: r.max === "" ? null : Number(r.max) });
                return (
                  <div key={i} className={`grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1.4fr)_90px_70px_80px_80px_32px] sm:border-0 sm:p-0 ${bad ? "border-status-danger" : "border-ink-100"}`}>
                    <Input aria-label={`Property ${i + 1}`} placeholder="Tenacity" value={r.label} onChange={(e) => setRow(i, { label: e.target.value, key: undefined })} wrapperClassName="col-span-2 sm:col-span-1" />
                    {/* Labelled on a phone, where the column headings are not shown. */}
                    <div className="min-w-0"><span aria-hidden className="mb-1 block text-xs font-medium text-ink-400 sm:hidden">Value</span>
                      <Input aria-label={`Value ${i + 1}`} type="number" step="any" placeholder="Value" value={r.value} onChange={(e) => setRow(i, { value: e.target.value === "" ? "" : Number(e.target.value) })} allowNegative error={bad ? "out of range" : undefined} /></div>
                    <div className="min-w-0"><span aria-hidden className="mb-1 block text-xs font-medium text-ink-400 sm:hidden">Unit</span>
                      <Input aria-label={`Unit ${i + 1}`} placeholder="Unit" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} /></div>
                    <div className="min-w-0"><span aria-hidden className="mb-1 block text-xs font-medium text-ink-400 sm:hidden">Min</span>
                      <Input aria-label={`Min ${i + 1}`} type="number" step="any" placeholder="Min" value={r.min} onChange={(e) => setRow(i, { min: e.target.value === "" ? "" : Number(e.target.value) })} allowNegative /></div>
                    <div className="min-w-0"><span aria-hidden className="mb-1 block text-xs font-medium text-ink-400 sm:hidden">Max</span>
                      <Input aria-label={`Max ${i + 1}`} type="number" step="any" placeholder="Max" value={r.max} onChange={(e) => setRow(i, { max: e.target.value === "" ? "" : Number(e.target.value) })} allowNegative /></div>
                    <button type="button" aria-label={`Remove property ${i + 1}`} className="grid h-10 w-10 place-items-center self-end rounded-lg sm:self-start text-ink-400 hover:bg-status-dangerBg hover:text-status-danger" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
              <Button type="button" variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, { label: "", value: "", unit: "", min: "", max: "" }])}><Plus className="h-4 w-4" aria-hidden /> Add a property</Button>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => { setRead(null); setMode(kept ? "view" : "read"); }}>Back</Button>
              <Button onClick={save} disabled={!ready} loading={saveCertificate.isPending}>Keep the certificate</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TestsTable({ tests }: { tests: LotCertificate["tests"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm" aria-label="Tests">
        <thead><tr className="text-xs text-ink-400"><th className="text-left font-medium">Property</th><th className="text-right font-medium">Value</th><th className="text-right font-medium">Range</th></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {tests.map((t) => (
            <tr key={t.key}>
              <td className="py-1">{t.label}</td>
              <td className={`py-1 text-right tabular-nums ${outOfSpec(t) ? "font-semibold text-status-danger" : ""}`}>{t.value}{t.unit ? ` ${t.unit}` : ""}</td>
              <td className="py-1 text-right tabular-nums text-ink-500">{range(t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The certified lots of a yarn side by side, and lots found by a property. */
export function LotCompare({ materialId }: { materialId: string }) {
  const cmp = useQuery({ queryKey: ["yarn-lots", "compare", materialId], queryFn: () => materialService.compareLots(materialId) });
  const [key, setKey] = useState("");
  const [min, setMin] = useState<number | "">("");
  const [max, setMax] = useState<number | "">("");
  const [found, setFound] = useState<LotSearchRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const c = cmp.data;
  if (!c || !c.lots.length) return null;
  const find = async () => {
    setBusy(true);
    try { setFound(await materialService.searchLotCertificates({ material: materialId, key: key || c.keys[0].key, min, max })); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not search the lots", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Card className="mt-4 p-5" aria-label="Lots compared by their certificates">
      <h3 className="font-semibold">Lots compared by their test certificates</h3>
      <p className="text-xs text-ink-400">The {c.lots.length} latest certified lot{c.lots.length === 1 ? "" : "s"}. A value outside the range its certificate gives is in red.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: `${220 + c.lots.length * 90}px` }} aria-label="Certified lots side by side">
          <thead>
            <tr className="border-b border-ink-200 text-xs text-ink-500">
              <th className="py-2 text-left font-medium">Property</th>
              {c.lots.map((l) => <th key={l._id} className="py-2 text-right font-medium">{l.lotNo}{l.date && <span className="block font-normal text-ink-400">{formatDate(l.date)}</span>}</th>)}
              <th className="py-2 pl-3 text-right font-medium">Average</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {c.rows.map((r) => (
              <tr key={r.key}>
                <td className="py-1.5">{r.label}{r.unit && <span className="text-ink-400"> ({r.unit})</span>}</td>
                {r.cells.map((cell, i) => <td key={i} className={`py-1.5 text-right tabular-nums ${cell?.outOfSpec ? "font-semibold text-status-danger" : ""}`}>{cell ? cell.value : <span className="text-ink-300">—</span>}</td>)}
                <td className="py-1.5 pl-3 text-right tabular-nums text-ink-600">{r.avg != null ? r.avg.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2" aria-label="Find lots by a property">
        <Select label="Find lots by" value={key || c.keys[0].key} onChange={(e) => setKey(e.target.value)} options={c.keys.map((k) => ({ value: k.key, label: k.unit ? `${k.label} (${k.unit})` : k.label }))} />
        <Input label="From" type="number" step="any" value={min} onChange={(e) => setMin(e.target.value === "" ? "" : Number(e.target.value))} className="w-24" />
        <Input label="To" type="number" step="any" value={max} onChange={(e) => setMax(e.target.value === "" ? "" : Number(e.target.value))} className="w-24" />
        <Button variant="secondary" onClick={find} loading={busy}><Search className="h-4 w-4" aria-hidden /> Find lots</Button>
      </div>
      {found && (
        found.length === 0 ? <p className="mt-2 text-sm text-ink-400">No lot of this yarn has that.</p> : (
          <ul className="mt-2 divide-y divide-ink-100 text-sm" aria-label="Lots found">
            {found.map((l) => (
              <li key={l._id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>{l.lotNo}{l.shade ? ` · ${l.shade}` : ""} <StatusChip tone={l.status === "open" ? "success" : "neutral"}>{l.status}</StatusChip></span>
                <span className="tabular-nums"><span className={l.outOfSpec ? "font-semibold text-status-danger" : ""}>{l.value}{l.unit ? ` ${l.unit}` : ""}</span> · {l.balance.toLocaleString("en-IN")} kg left</span>
              </li>
            ))}
          </ul>
        )
      )}
    </Card>
  );
}
