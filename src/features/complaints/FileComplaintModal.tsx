import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { customerService } from "@/features/customers/api";
import { jobService } from "@/features/jobs/api";
import { complaintService } from "./api";
import { COMPLAINT_CATEGORIES, type ComplaintCategory } from "./types";

// ══════════════════════════════════════════════════════════════════
//  FILING WHAT A CUSTOMER SAID
//
//  The job is required and it is not a formality: the whole value of a
//  complaint record here is the lot trail behind it, and a complaint
//  with no job is a complaint with no trail. The backend also refuses a
//  job belonging to a different customer, because a mismatched pair
//  produces a blast radius for somebody else's goods.
//
//  The elastic is optional on purpose. A job routinely carries several
//  and the customer rarely names one. Guessing here would narrow the
//  trace to the wrong product — the exact failure this feature exists
//  to prevent — so "they did not say" is a first-class answer and the
//  trace then covers the whole job.
// ══════════════════════════════════════════════════════════════════

export function FileComplaintModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [customer, setCustomer] = useState("");
  const [job, setJob] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("shade");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const file = useMutation({
    mutationFn: () => complaintService.create({ customer, job, category, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaints"] });
      qc.invalidateQueries({ queryKey: ["complaint-themes"] });
      toast("Complaint filed", "success");
      onClose();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not file that complaint"),
  });

  const submit = () => {
    setError(null);
    if (!customer) return setError("Pick the customer");
    if (!job) return setError("Pick the job they received — the trail runs through it");
    if (!reason.trim()) return setError("Say what they reported");
    file.mutate();
  };

  return (
    <FormScreen open onClose={onClose} title="File a complaint" width="max-w-xl">
      <div className="space-y-4">
        <AsyncCombobox
          label="Customer"
          value={customer}
          onChange={(v) => { setCustomer(v); setJob(""); }}
          loadOptions={async (q) => {
            const res = await customerService.list({ page: 1, limit: 20, search: q });
            return res.customers.map((c) => ({ value: c._id, label: c.name }));
          }}
        />

        <AsyncCombobox
          label="Job they received"
          value={job}
          onChange={setJob}
          disabled={!customer}
          placeholder={customer ? "Select…" : "Pick a customer first"}
          // Filtered server-side. Doing it on the returned page instead
          // would hide every job outside the newest twenty, which for a
          // complaint about goods delivered months ago is all of them.
          loadOptions={async (q) => {
            const res = await jobService.list({
              page: 1, limit: 20, status: "all", search: q, customer,
            });
            return res.jobs.map((j) => ({
              value: j._id,
              label: `Job ${j.jobOrderNo ?? ""} — ${j.status}`,
            }));
          }}
          emptyText="No jobs found for that customer"
        />

        <Select
          label="What is it about"
          value={category}
          onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
          options={COMPLAINT_CATEGORIES.map((c) => ({
            value: c, label: c[0].toUpperCase() + c.slice(1),
          }))}
        />

        <Input
          label="What they said"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Shade band visible across the roll"
        />

        <p className="text-xs text-ink-400">
          The product is left off deliberately unless the customer named one — the
          trace then covers the whole job rather than narrowing to a guess.
        </p>

        {error && <p className="text-sm text-status-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={file.isPending}>
            {file.isPending ? "Filing…" : "File complaint"}
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}

export default FileComplaintModal;
