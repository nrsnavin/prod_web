import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, AlertTriangle, Mic, MicOff, Camera, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { cn } from "@/components/ui/cn";
import { machineService } from "@/features/machines/api";
import { issueService, MachineIssue, type IssueIntake } from "./api";
import { useSpeech, type SpeechLang } from "@/core/hooks/useSpeech";
import { formatDate } from "@/core/format/date";
import { useAuth } from "@/core/auth/useAuth";

const SEVERITIES = ["low", "medium", "high", "critical"];
const SERVICE_TYPES = ["Corrective", "Preventive", "Breakdown", "Inspection", "Other"];

// The server calls a dismissed issue "rejected"; sending "dismissed" was refused.
const STATUSES = ["open", "acknowledged", "in_progress", "resolved", "rejected"];
const STATUS_LABEL: Record<string, string> = { in_progress: "in progress", rejected: "dismissed" };
const statusTone: Record<string, ChipTone> = {
  open: "danger",
  acknowledged: "warning",
  in_progress: "info",
  resolved: "success",
  rejected: "neutral",
};
/** The two ways an issue ends. */
const CLOSED = ["resolved", "rejected"];

/**
 * Red for the two that stop a loom. The colours were written for three
 * severities and there are four: "critical" fell through to the chip of
 * a low one.
 */
export function severityTone(severity?: string): ChipTone {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "info";
}

const nameOf = (who: MachineIssue["reportedBy"]) => (who && typeof who === "object" ? who.name ?? "" : "");

/**
 * Who raised it: the operator, the supervisor at the floor entry, or the
 * office. "" when nobody is known. Only the first used to be shown, so
 * the other two came with no name at all.
 */
export function reportedLine(i: MachineIssue): string {
  if (i.source === "floor") return `Raised at the floor entry${i.reportedByName ? ` by ${i.reportedByName}` : ""}`;
  if (i.employee?.name) return `Reported by ${i.employee.name}`;
  const office = nameOf(i.reportedBy);
  return office ? `Reported by ${office} (office)` : "";
}

/** "Resolved 10 Nov 2026 by Owner" — for an issue that is closed; "" otherwise. */
export function closingLine(i: MachineIssue): string {
  if (!CLOSED.includes(i.status)) return "";
  const who = nameOf(i.resolvedBy);
  if (!i.resolvedAt && !who) return "";
  return [i.status === "resolved" ? "Resolved" : "Dismissed", i.resolvedAt ? formatDate(i.resolvedAt) : "", who ? `by ${who}` : ""]
    .filter(Boolean)
    .join(" ");
}

function UpdateModal({ issue, onClose }: { issue: MachineIssue; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState(issue.status);
  const [notes, setNotes] = useState(issue.resolutionNotes ?? "");

  // Optional service log captured when the issue is resolved.
  const [logType, setLogType] = useState("Corrective");
  const [logDesc, setLogDesc] = useState("");
  const [technician, setTechnician] = useState("");
  const [cost, setCost] = useState("");
  const [nextService, setNextService] = useState("");

  const resolving = status === "resolved";
  const closing = CLOSED.includes(status);
  // What goes on the issue: the notes typed — or, resolving with only the
  // service log filled in, the work done (it need not be typed twice).
  const finalNotes = notes.trim() || (resolving ? logDesc.trim() : "");
  // The operator who reported it reads this note: an issue is not
  // resolved or dismissed without a word of why. (The phone never
  // allowed it; this form did.)
  const needsNote = closing && !finalNotes;
  // Notes are sent when they were changed. Untouched, the request says
  // nothing of them and the server keeps what it has — a colleague's
  // later note included. Cleared, they are sent as cleared.
  const notesChanged = finalNotes !== (issue.resolutionNotes ?? "").trim();

  const update = useMutation({
    mutationFn: async () => {
      await issueService.setStatus(issue._id, status, notesChanged ? finalNotes : undefined);
      // On resolution, also append a service log to the machine if the
      // engineer filled in the service details.
      if (resolving && logDesc.trim() && issue.machine?._id) {
        await machineService.addServiceLog(issue.machine._id, {
          type: logType as "Corrective" | "Preventive" | "Breakdown" | "Inspection" | "Other",
          description: logDesc.trim(),
          technician: technician.trim() || undefined,
          cost: cost ? Number(cost) : undefined,
          nextServiceDate: nextService || undefined,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-issues"] });
      qc.invalidateQueries({ queryKey: ["machines"] });
    },
  });

  return (
    <FormScreen open onClose={onClose} title={`Issue — ${issue.machine?.ID ?? "machine"}`} width="max-w-md">
      <p className="text-sm text-ink-600 rounded-xl bg-ink-100/60 p-3">
        {issue.description ?? issue.title ?? ""}
      </p>
      <div className="mt-3 space-y-3">
        <Select
          label="Status"
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }))}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        <Input
          label={closing ? "Resolution notes *" : "Resolution notes"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={status === "rejected" ? "Why it is dismissed" : "What was done"}
          hint={
            needsNote
              ? `${resolving ? "Say what was done" : "Say why"} — the operator who reported it sees this.`
              : undefined
          }
        />

        {resolving && (
          <div className="rounded-lg border border-ink-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Wrench className="h-4 w-4 text-ink-400" /> Service log (optional)
            </p>
            <div className="space-y-2">
              <Select
                label="Type"
                options={SERVICE_TYPES.map((t) => ({ value: t, label: t }))}
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
              />
              <Input label="Work done" value={logDesc} onChange={(e) => setLogDesc(e.target.value)} placeholder="e.g. Replaced drive belt" />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Technician" value={technician} onChange={(e) => setTechnician(e.target.value)} />
                <Input label="Cost (₹)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <Input label="Next service date" type="date" value={nextService} onChange={(e) => setNextService(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          loading={update.isPending}
          disabled={needsNote}
          onClick={() =>
            update.mutate(undefined, {
              onSuccess: () => {
                toast(resolving && logDesc.trim() ? "Issue resolved & service logged" : "Issue updated", "success");
                onClose();
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Failed", "error"),
            })
          }
        >
          Update issue
        </Button>
      </div>
    </FormScreen>
  );
}

// ── Report a new issue (admin) ──────────────────────────────────
function ReportIssueModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [machineId, setMachineId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  // Said or typed in the worker's own words, then written up.
  const [said, setSaid] = useState("");
  const [lang, setLang] = useState<SpeechLang>("ta-IN");
  const [photo, setPhoto] = useState<File | null>(null);
  const [intake, setIntake] = useState<IssueIntake | null>(null);
  const [writing, setWriting] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const speech = useSpeech((t) => setSaid((x) => (x ? `${x} ${t}` : t)));

  const writeUp = async () => {
    setWriting(true);
    try {
      const r = await issueService.intake(machineId, said, photo);
      setIntake(r);
      setTitle(r.title); setDescription(r.description); setSeverity(r.severity);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not write it up", "error");
    } finally {
      setWriting(false);
    }
  };
  const dup = intake?.duplicateOf ? intake.openIssues.find((o) => o._id === intake.duplicateOf) : null;

  const machines = useQuery({
    queryKey: ["machines", "all"],
    queryFn: () => machineService.list("all"),
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: () => issueService.create({ machineId, title: title.trim(), description: description.trim(), severity, ...(intake?.aiSuggestion ? { aiSuggestion: intake.aiSuggestion } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-issues"] });
      qc.invalidateQueries({ queryKey: ["machine-anomalies"] });
    },
  });

  const valid = machineId && title.trim() && description.trim();

  return (
    <FormScreen open onClose={onClose} title="Report machine issue" width="max-w-md">
      <div className="space-y-3">
        <Combobox
          label="Machine *"
          placeholder="Select machine"
          options={(machines.data ?? []).map((m) => ({ value: m._id, label: `Machine ${m.ID}` }))}
          value={machineId}
          onChange={(v) => { setMachineId(v); setIntake(null); }}
        />
        <div className="space-y-2 rounded-lg border border-ink-100 p-3">
          <label htmlFor="issue-said" className="block text-sm font-medium text-ink-700">What is wrong — say it or type it</label>
          <textarea id="issue-said" rows={3} value={said} onChange={(e) => setSaid(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-surface p-2 text-sm" placeholder="In Tamil or English, in your own words" />
          <div className="flex flex-wrap items-center gap-2">
            {speech.supported && (
              <>
                <select aria-label="Speaking in" value={lang} onChange={(e) => setLang(e.target.value as SpeechLang)} className="h-8 rounded-lg border border-ink-200 bg-surface px-2 text-sm">
                  <option value="ta-IN">தமிழ்</option>
                  <option value="en-IN">English</option>
                </select>
                {speech.listening
                  ? <Button size="sm" variant="secondary" onClick={speech.stop}><MicOff className="h-4 w-4" /> Stop</Button>
                  : <Button size="sm" variant="secondary" onClick={() => speech.start(lang)}><Mic className="h-4 w-4" /> Speak</Button>}
              </>
            )}
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" aria-label="Fault photo" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            <Button size="sm" variant="ghost" onClick={() => photoRef.current?.click()}><Camera className="h-4 w-4" /> {photo ? "Photo added" : "Photo"}</Button>
            <Button size="sm" loading={writing} disabled={!machineId || (!said.trim() && !photo)} onClick={writeUp}><Sparkles className="h-4 w-4" /> Write it up</Button>
          </div>
          {speech.listening && <p className="text-xs text-status-danger">Listening… speak now.</p>}
          {speech.error && <p className="text-xs text-status-warning">{speech.error}</p>}
          {intake && <p className="text-xs text-ink-500">{intake.aiGenerated ? "Written up by AI from what was said — check it before reporting." : "Filled from what was said — check it before reporting."}</p>}
        </div>
        {dup && (
          <div role="alert" className="rounded-lg bg-status-warningBg p-3 text-sm text-status-warning">
            Looks like an issue already open on this machine: <span className="font-semibold">{dup.title}</span> ({dup.status.replace("_", " ")}). Report it only if it is a different fault.
            <div className="mt-2"><Button size="sm" variant="secondary" onClick={onClose}>It is the same — don't report</Button></div>
          </div>
        )}
        {!dup && intake && intake.openIssues.length > 0 && (
          <p className="text-xs text-ink-500">Already open on this machine: {intake.openIssues.map((o) => o.title).join("; ")}</p>
        )}
        <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Loom stops intermittently" />
        <Input label="Description *" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's happening" />
        <Select
          label="Severity"
          options={SEVERITIES.map((s) => ({ value: s, label: s }))}
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!valid}
          loading={create.isPending}
          onClick={() =>
            create.mutate(undefined, {
              onSuccess: () => {
                toast("Issue reported", "success");
                onClose();
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to report", "error"),
            })
          }
        >
          Report issue
        </Button>
      </div>
    </FormScreen>
  );
}

// ── Repeat-offender anomaly banner (tunable window / threshold) ──
function AnomalyBanner() {
  const [days, setDays] = useState(30);
  const [threshold, setThreshold] = useState(3);
  const { data, isError } = useQuery({
    queryKey: ["machine-anomalies", days, threshold],
    queryFn: () => issueService.anomalies(days, threshold),
  });
  const anomalies = data?.anomalies ?? [];
  const hit = anomalies.length > 0;

  // A check that failed is not an all-clear: this used to fall through
  // to "No repeat-offender machines", in green.
  if (isError) {
    return (
      <Card className="mb-4 p-4">
        <p className="flex items-center gap-2 text-sm text-ink-500">
          <AlertTriangle className="h-4 w-4" /> Could not check for machines that keep breaking down.
        </p>
      </Card>
    );
  }

  const controls = (
    <div className="flex items-center gap-2 text-xs text-ink-500">
      <span>flag</span>
      <select aria-label="Issue threshold"
        value={threshold}
        onChange={(e) => setThreshold(Number(e.target.value))}
        className="rounded border border-ink-200 bg-surface px-1.5 py-0.5"
      >
        {[2, 3, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
      </select>
      <span>issues in</span>
      <select aria-label="Time window in days"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        className="rounded border border-ink-200 bg-surface px-1.5 py-0.5"
      >
        {[7, 30, 90].map((n) => <option key={n} value={n}>{n}d</option>)}
      </select>
    </div>
  );

  return (
    <Card className={cn("mb-4 border-l-4 p-4", hit ? "border-status-danger" : "border-status-success")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("flex items-center gap-2 text-sm font-semibold", hit ? "text-status-danger" : "text-status-success")}>
          <AlertTriangle className="h-4 w-4" />
          {hit
            ? `Frequent breakdowns — ${anomalies.length} machine${anomalies.length === 1 ? "" : "s"} flagged`
            : `No repeat-offender machines (${threshold}+ in ${days}d)`}
        </p>
        {controls}
      </div>
      {hit && (
        <div className="mt-2 flex flex-wrap gap-2">
          {anomalies.map((a) => (
            <span
              key={a.machineId}
              className="inline-flex items-center gap-2 rounded-full border border-status-danger/30 bg-status-dangerBg px-3 py-1 text-sm"
            >
              <span className="font-medium">Machine {a.machineID ?? "—"}</span>
              <span className="tabular-nums text-status-danger">{a.count} issues</span>
              {a.openCount > 0 && <span className="text-xs text-ink-500">· {a.openCount} open</span>}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

export function MachineIssuesPage() {
  const me = useAuth().user;
  const role = me?.role;
  // …and not for an employee's own login, which carries the role
  // "production" too: the server refuses it the roll-up.
  const canSeeAnomalies = (role === "admin" || role === "production") && me?.selfService !== true;
  // Closing an issue is the office's: a worker's own login reports one
  // and follows it, and the server refuses its status change.
  const canUpdate = me?.selfService !== true;
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<MachineIssue | null>(null);
  const [reporting, setReporting] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["machine-issues", status],
    queryFn: () => issueService.list(status),
  });

  return (
    <>
      <PageHeader
        title="Machine issues"
        subtitle="Problems reported from the floor, and by admins."
        actions={
          <Button onClick={() => setReporting(true)}>
            <Plus className="h-4 w-4" /> Report issue
          </Button>
        }
      />

      {/* The breakdown pattern is for admin and production (api/machineIssue.js). */}
      {canSeeAnomalies && <AnomalyBanner />}

      <div className="mb-4">
        <FilterChips
          options={[{ value: "all", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }))]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench className="h-12 w-12" />}
            title="No machine issues"
            description="Operator-reported problems appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.map((i) => (
            <Card key={i._id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="h-10 w-10 rounded-lg bg-ink-100 grid place-items-center text-ink-600 shrink-0">
                  <Wrench className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {i.machine?.ID ?? "Machine"}
                    {i.severity && (
                      <StatusChip tone={severityTone(i.severity)} className="ml-2">
                        {i.severity}
                      </StatusChip>
                    )}
                  </p>
                  {/* The title the reporter gave, then what they said of it. */}
                  {i.title && i.title !== i.description && (
                    <p className="mt-1 text-sm font-medium text-ink-900">{i.title}</p>
                  )}
                  {i.description && <p className="mt-1 text-sm text-ink-600">{i.description}</p>}
                  <p className="mt-1 text-xs text-ink-400">
                    {[reportedLine(i), i.createdAt ? formatDate(i.createdAt) : ""].filter(Boolean).join(" · ")}
                  </p>
                  {i.resolutionNotes && (
                    <p className="mt-2 rounded-lg bg-status-successBg px-3 py-2 text-sm">
                      {i.resolutionNotes}
                    </p>
                  )}
                  {closingLine(i) && <p className="mt-1 text-xs text-ink-400">{closingLine(i)}</p>}
                </div>
                <StatusChip tone={statusTone[i.status] ?? "neutral"}>
                  {STATUS_LABEL[i.status] ?? i.status}
                </StatusChip>
                {canUpdate && i.status !== "resolved" && i.status !== "rejected" && (
                  <Button size="sm" variant="secondary" onClick={() => setEditing(i)}>
                    Update
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <UpdateModal issue={editing} onClose={() => setEditing(null)} />}
      {reporting && <ReportIssueModal onClose={() => setReporting(false)} />}
    </>
  );
}
