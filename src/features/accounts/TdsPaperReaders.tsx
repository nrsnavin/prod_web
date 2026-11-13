import { useState } from "react";
import { FileScan } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { PartyPicker, money } from "./shared";
import { PaperChecks, PaperPicker, ReadProblem } from "./PaperReader";
import type { Form16aResult, TdsChallanResult } from "./types";

// ══════════════════════════════════════════════════════════════════
//  TDS PAPERS, READ INTO THE REGISTERS (api/accountsPapers.js /tds/read)
//
//    "Read the challan"   our TDS challan receipt: BSR code, serial, the
//                         date, section, tax and interest, and the month it
//                         pays (the month whose deduction it pays off
//                         exactly, else the month before a deposit made by
//                         the 7th) — filled into the challan form.
//    "Read a Form 16A"    a customer's certificate: the customer by TAN, the
//                         year and quarter, the number, section and tax —
//                         confirmed here and saved to certificates received.
//
//  Form 26AS as a PDF goes through the same upload button as the CSV (in
//  StatutoryTab), and replaces the year's lines as that always has.
// ══════════════════════════════════════════════════════════════════

export function ChallanReader({ onUse }: { onUse: (result: TdsChallanResult) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}><FileScan className="h-4 w-4" aria-hidden /> Read the challan</Button>
      {open && <ChallanDialog onClose={() => setOpen(false)} onUse={(r) => { onUse(r); setOpen(false); }} />}
    </>
  );
}

function ChallanDialog({ onClose, onUse }: { onClose: () => void; onUse: (result: TdsChallanResult) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TdsChallanResult | null>(null);
  const read = async (files: File[]) => {
    setBusy(true);
    try { setResult(await accountsService.readTdsPaper("challan", files)); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not read the challan", "error"); }
    finally { setBusy(false); }
  };
  const r = result;
  const d = r?.draft;
  return (
    <Modal open onClose={onClose} title="Read the TDS challan" width="max-w-xl" confirmDirtyClose={false}>
      <div className="space-y-4">
        {!r && (
          <>
            <p className="text-sm text-ink-600">The challan receipt from the bank or the income-tax e-pay site: a photo or the PDF. The BSR code, serial, date, section and amounts are read, and the month it pays is worked out from the register.</p>
            <PaperPicker label="Challan photo" max={2} busy={busy} onFiles={read} />
          </>
        )}
        {r?.read.problem && <ReadProblem>{r.read.problem === "not_a_challan" ? "That does not look like a tax challan." : "The challan could not be read. Try a sharper photo or the PDF."}</ReadProblem>}
        {r && !r.read.problem && (
          <div className="space-y-3 text-sm" aria-label="What the challan says">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Section {r.read.section || "not read"}</span>
              {r.read.natureOfPayment && <span className="text-ink-500">{r.read.natureOfPayment}</span>}
              <span className="ml-auto text-base font-semibold tabular-nums">{d ? `₹${money(d.amount)}` : "No amount read"}</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink-600">
              <dt>BSR / serial</dt><dd className="tabular-nums">{r.read.bsrCode || "—"} / {r.read.challanNo || "—"}</dd>
              <dt>Deposited</dt><dd>{r.read.depositedOn ? formatDate(r.read.depositedOn) : "not read"}</dd>
              {d && d.interest > 0 ? <><dt>Interest</dt><dd className="tabular-nums">₹{money(d.interest)}</dd></> : null}
              {r.read.total != null ? <><dt>Challan total</dt><dd className="tabular-nums">₹{money(r.read.total)}</dd></> : null}
              {d?.month ? <><dt>Pays</dt><dd>{d.month}<span className="block text-xs text-ink-400">{d.monthWhy}</span></dd></> : null}
            </dl>
            <PaperChecks checks={r.checks} label="Checks on the challan" />
            {r.duplicate && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-status-danger">Already recorded against {r.duplicate.month}, section {r.duplicate.section}, for ₹{money(r.duplicate.amount)}.</p>}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setResult(null)}>Read another</Button>
              <Button onClick={() => onUse(r)} disabled={!d || !!r.duplicate}>Fill the challan</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function Form16aReader({ onSaved }: { onSaved: (fy: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}><FileScan className="h-4 w-4" aria-hidden /> Read a Form 16A</Button>
      {open && <Form16aDialog onClose={() => setOpen(false)} onSaved={(fy) => { onSaved(fy); setOpen(false); }} />}
    </>
  );
}

const FY = /^\d{4}-\d{2}$/;

function Form16aDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (fy: string) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Form16aResult | null>(null);
  const [party, setParty] = useState("");
  const [partyName, setPartyName] = useState("");
  const [fy, setFy] = useState("");
  const [quarter, setQuarter] = useState("");
  const [certNo, setCertNo] = useState("");
  const [section, setSection] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [on, setOn] = useState("");
  // Typed in, not read: when there is no reader on the server, or the read failed.
  const [typing, setTyping] = useState(false);
  const typeIt = () => { setResult(null); setTyping(true); if (!on) setOn(new Date().toISOString().slice(0, 10)); };

  const read = async (files: File[]) => {
    setBusy(true);
    try {
      const r = await accountsService.readTdsPaper("form16a", files);
      setResult(r);
      const d = r.draft;
      if (d) {
        setParty(d.party ?? ""); setPartyName(r.customer?.name ?? ""); setFy(d.fy); setQuarter(d.quarter); setCertNo(d.certNo);
        setSection(d.section); setAmount(d.amount); setOn(d.on);
      }
    } catch (e) { toast(e instanceof Error ? e.message : "Could not read the Form 16A", "error"); }
    finally { setBusy(false); }
  };

  const ready = !!party && FY.test(fy) && ["Q1", "Q2", "Q3", "Q4"].includes(quarter) && Number(amount) >= 0 && amount !== "";
  const save = async () => {
    setSaving(true);
    try {
      await accountsService.addTdsCertificate({ kind: "received", party, fy, quarter, certNo: certNo.trim() || undefined, section: section.trim() || undefined, amount: Number(amount), on: on || undefined, tdsSuggestion: result?.aiSuggestion ?? undefined });
      toast(`Form 16A of ${partyName || "the customer"} for ${fy} ${quarter} recorded`, "success");
      onSaved(fy);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not record it", "error"); }
    finally { setSaving(false); }
  };

  const r = result;
  const showForm = (r && !r.read.problem) || typing;
  return (
    <Modal open onClose={onClose} title={typing ? "Enter a Form 16A" : "Read a Form 16A"} width="max-w-xl" confirmDirtyClose={false}>
      <div className="space-y-4">
        {!r && !typing && (
          <>
            <p className="text-sm text-ink-600">The TDS certificate a customer sent: the PDF from TRACES or a photo of it. Who issued it is found by TAN, and the year, quarter and tax are read for you to check.</p>
            <div className="flex flex-wrap items-center gap-2">
              <PaperPicker label="Form 16A file" max={3} busy={busy} onFiles={read} />
              <Button type="button" variant="ghost" onClick={typeIt}>Type it in instead</Button>
            </div>
          </>
        )}
        {r?.read.problem && (
          <>
            <ReadProblem>{r.read.problem === "not_a_form16a" ? "That does not look like a Form 16A." : "The certificate could not be read. Try the PDF from TRACES."}</ReadProblem>
            <Button type="button" variant="ghost" onClick={typeIt}>Type it in instead</Button>
          </>
        )}
        {showForm && (
          <div className="space-y-3 text-sm" aria-label={r ? "What the certificate says" : "The certificate"}>
            {r && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.read.deductorName || "Deductor not read"}</span>
                  {r.read.deductorTan && <span className="font-mono text-xs text-ink-500">TAN {r.read.deductorTan}</span>}
                  {r.customer ? <StatusChip tone={r.customer.matchedBy === "tan" ? "success" : "warning"}>{r.customer.matchedBy === "tan" ? "by TAN" : "by name: confirm"}</StatusChip> : <StatusChip tone="danger">pick the customer</StatusChip>}
                </div>
                <PaperChecks checks={r.checks} label="Checks on the certificate" />
                {r.duplicate && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-status-danger">This certificate is recorded already, for ₹{money(r.duplicate.amount)}.</p>}
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><PartyPicker partyType="customer" value={party} knownName={partyName || undefined} onChange={(id, name) => { setParty(id); setPartyName(name); }} /></div>
              <Input label="Financial year" value={fy} onChange={(e) => setFy(e.target.value.trim())} placeholder="2026-27" error={fy && !FY.test(fy) ? "As 2026-27" : undefined} />
              <Select label="Quarter" value={quarter} onChange={(e) => setQuarter(e.target.value)} options={["Q1", "Q2", "Q3", "Q4"].map((q) => ({ value: q, label: q }))} placeholder="Pick" />
              <Input label="Certificate no." value={certNo} onChange={(e) => setCertNo(e.target.value.toUpperCase())} />
              <Input label="Section" value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} />
              <Input label="TDS (₹)" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
              <Input label="Received on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {r && <Button variant="secondary" onClick={() => setResult(null)}>Read another</Button>}
              <Button onClick={save} disabled={!ready || !!r?.duplicate} loading={saving}>Save the certificate</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
