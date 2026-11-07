import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { httpClient } from "@/core/http/httpClient";
import { PhotoFillButton } from "@/features/common/PhotoFill";
import type { DcPod } from "./types";

type Issue = "" | "short" | "damaged" | "wrong";

/** What the signed copy says, what does not fit this challan, and the complaint it would open. */
export interface PodScan {
  read: { problem: null | "not_a_pod" | "unreadable"; dcNumber?: string; deliveredOn?: string; receivedBy?: string; stamped?: boolean; remark?: string; issue?: Exclude<Issue, ""> | null; shortPackages?: number | null };
  checks: string[];
  complaint: { customer: string; jobs: { _id: string; jobOrderNo: number; status?: string }[]; category: string; reason: string } | null;
  aiSuggestion: string | null;
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const ISSUES: { value: Issue; label: string }[] = [
  { value: "", label: "Received in full" },
  { value: "short", label: "Short" },
  { value: "damaged", label: "Damaged" },
  { value: "wrong", label: "Wrong goods" },
];

/**
 * The customer's signed copy (or the transporter's POD), photographed:
 * the date, who took it and anything they wrote fill the form; a
 * shortage or damage offers to open a complaint against the order's job.
 */
export function ProofOfDeliveryDialog({ dc, onClose }: {
  dc: { _id: string; dcNumber: string; pod?: DcPod | null };
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scan, setScan] = useState<PodScan | null>(null);
  const [deliveredOn, setDeliveredOn] = useState(dc.pod?.deliveredOn?.slice(0, 10) || today());
  const [receivedBy, setReceivedBy] = useState(dc.pod?.receivedBy ?? "");
  const [remark, setRemark] = useState(dc.pod?.remark ?? "");
  const [issue, setIssue] = useState<Issue>((dc.pod?.issue as Issue) ?? "");
  const [openComplaint, setOpenComplaint] = useState(false);
  const [job, setJob] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const onRead = (r: PodScan) => {
    setScan(r);
    if (r.read.deliveredOn) setDeliveredOn(r.read.deliveredOn);
    if (r.read.receivedBy) setReceivedBy(r.read.receivedBy);
    setRemark(r.read.remark ?? "");
    setIssue(r.read.issue ?? "");
    if (r.complaint) {
      setOpenComplaint(true);
      setReason(r.complaint.reason);
      if (r.complaint.jobs.length === 1) setJob(r.complaint.jobs[0]._id);
    }
  };

  const canComplain = !!issue && !dc.pod?.complaint && !!scan?.complaint?.jobs.length;
  const save = async () => {
    setSaving(true);
    try {
      const res = await httpClient.post<{ complaint: string | null }>(`/dc/${dc._id}/pod`, {
        deliveredOn, receivedBy, remark, issue,
        stamped: !!scan?.read.stamped, source: scan && !scan.read.problem ? "photo" : "typed",
        aiSuggestion: scan?.aiSuggestion ?? null,
        complaint: canComplain && openComplaint && job ? { job, reason } : null,
      });
      qc.invalidateQueries({ queryKey: ["dc"] });
      qc.invalidateQueries({ queryKey: ["dcs"] });
      qc.invalidateQueries({ queryKey: ["delivery-challans"] });
      toast(res.complaint && !dc.pod?.complaint ? "Delivered — complaint opened" : "Delivery recorded", "success");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Proof of delivery · ${dc.dcNumber}`} width="max-w-lg">
      <div className="space-y-3">
        <PhotoFillButton<PodScan> url={`/dc/${dc._id}/pod/scan`} label={scan ? "Read another photo" : "Photograph the signed copy"} what="proof of delivery" onRead={onRead} />
        {scan?.checks.length ? <ul role="alert" className="space-y-1 rounded-lg bg-status-warningBg p-2 text-sm text-status-warning">{scan.checks.map((c) => <li key={c}>{c}</li>)}</ul> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Delivered on" type="date" max={today()} value={deliveredOn} onChange={(e) => setDeliveredOn(e.target.value)} />
          <Input label="Received by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Name or stamp" />
          <Select label="Condition" value={issue} onChange={(e) => setIssue(e.target.value as Issue)} options={ISSUES} />
          <Input label="Their remark" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. 2 boxes short" />
        </div>
        {canComplain && (
          <div className="space-y-2 rounded-lg border border-ink-100 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
              <input type="checkbox" checked={openComplaint} onChange={(e) => setOpenComplaint(e.target.checked)} />
              Open a complaint for this
            </label>
            {openComplaint && (
              <>
                <Select label="Against job" value={job} onChange={(e) => setJob(e.target.value)} placeholder="Pick the job" options={scan!.complaint!.jobs.map((j) => ({ value: j._id, label: `Job #${j.jobOrderNo}${j.status ? ` · ${j.status}` : ""}` }))} />
                <label className="block text-sm font-medium text-ink-600" htmlFor="pod-reason">What they said</label>
                <textarea id="pod-reason" className="w-full rounded-lg border border-ink-200 p-2 text-sm" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </>
            )}
          </div>
        )}
        {dc.pod?.complaint && <p className="text-xs text-ink-500">A complaint is already open for this delivery.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!deliveredOn || (openComplaint && canComplain && !job)} onClick={save}>Record delivery</Button>
        </div>
      </div>
    </Modal>
  );
}
