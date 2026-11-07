import { useRef, useState } from "react";
import { ImagePlus, Sparkles } from "lucide-react";
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
import { complaintService, type Intake } from "./api";
import { COMPLAINT_CATEGORIES, type ComplaintCategory } from "./types";
import { addable } from "@/features/common/quickCreateStore";

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
  const [elastic, setElastic] = useState("");
  const [error, setError] = useState<string | null>(null);
  // What the customer sent, and what reading it suggested.
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [read, setRead] = useState<Intake | null>(null);
  const [reading, setReading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const readIt = async () => {
    setError(null);
    if (!customer) return setError("Pick the customer first — the jobs to choose from are theirs");
    setReading(true);
    try {
      const r = await complaintService.intake(customer, message, photos);
      setRead(r);
      setCategory(r.category);
      if (r.reason) setReason(r.reason);
      if (r.jobs[0]) setJob(r.jobs[0]._id);
      setElastic(r.elastic?._id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the message");
    } finally {
      setReading(false);
    }
  };

  const file = useMutation({
    mutationFn: () => complaintService.create({
      customer, job, category, reason,
      ...(elastic ? { elastic } : {}),
      ...(message.trim() && message.trim() !== reason.trim() ? { feedback: `As the customer sent it:\n${message.trim().slice(0, 2000)}` } : {}),
      ...(read?.aiSuggestion ? { aiSuggestion: read.aiSuggestion } : {}),
    }),
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
          {...addable("customer")}
          label="Customer"
          value={customer}
          onChange={(v) => { setCustomer(v); setJob(""); setRead(null); setElastic(""); }}
          loadOptions={async (q) => {
            const res = await customerService.list({ page: 1, limit: 20, search: q });
            return res.customers.map((c) => ({ value: c._id, label: c.name }));
          }}
        />

        <div className="space-y-2 rounded-lg border border-ink-100 p-3">
          <label htmlFor="complaint-message" className="block text-sm font-medium text-ink-700">What the customer sent (optional)</label>
          <textarea id="complaint-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-surface p-2 text-sm"
            placeholder="Paste their WhatsApp or email, or write down the call — English or Tamil." />
          <div className="flex flex-wrap items-center gap-2">
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" aria-label="Complaint photos"
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 3))} />
            <Button size="sm" variant="ghost" onClick={() => photoRef.current?.click()}><ImagePlus className="h-4 w-4" /> {photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : "Their photos"}</Button>
            <Button size="sm" variant="secondary" loading={reading} disabled={!customer || (!message.trim() && !photos.length)} onClick={readIt}>
              <Sparkles className="h-4 w-4" /> Fill the form from it
            </Button>
          </div>
          {read && (
            <div className="text-xs text-ink-500">
              {read.jobs.length ? (
                <ul className="space-y-1" aria-label="Likely jobs">
                  {read.jobs.map((j) => (
                    <li key={j._id}>
                      <button type="button" onClick={() => setJob(j._id)} className={`text-left hover:underline ${job === j._id ? "font-semibold text-brand-700" : "text-brand-600"}`}>
                        Job {j.jobOrderNo ?? ""}
                      </button>{" "}— {j.why}
                    </li>
                  ))}
                </ul>
              ) : <p>Nothing in the message points to one of their {read.candidates} recent jobs — pick it below.</p>}
              {read.elastic ? <p className="mt-1">They named <span className="font-medium">{read.elastic.name}</span>: the trace follows that product only. <button type="button" className="text-brand-600 hover:underline" onClick={() => setElastic("")}>Trace the whole job instead</button></p> : null}
              <p className="mt-1">{read.aiGenerated ? "Read by AI — check the job and the words before filing." : "Matched by keywords — check the job and the words before filing."}</p>
            </div>
          )}
        </div>

        <AsyncCombobox
          label="Job they received"
          value={job}
          onChange={(v) => { setJob(v); if (elastic && !read?.jobs.find((j) => j._id === v)?.elastics.some((e) => e._id === elastic)) setElastic(""); }}
          disabled={!customer}
          placeholder={customer ? "Select…" : "Pick a customer first"}
          // Filtered server-side. Doing it on the returned page instead
          // would hide every job outside the newest twenty, which for a
          // complaint about goods delivered months ago is all of them.
          seedOptions={(read?.jobs ?? []).map((j) => ({ value: j._id, label: `Job ${j.jobOrderNo ?? ""} — ${j.status}` }))}
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
