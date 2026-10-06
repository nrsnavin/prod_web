import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import { slipService } from "./api";
import { isReading, useSlip, useSlipMutations } from "./hooks";
import { Shift, Slip, SlipEdit, SlipRow } from "./types";
import {
  DATE_FROM, countsSummary, editProblem, editable, initialEdits, shiftTitle, statusLabel, statusTone,
} from "./slipText";

// ══════════════════════════════════════════════════════════════════
//  ONE SLIP: THE PHOTO BESIDE WHAT WAS READ FROM IT
//
//  Rows that read cleanly come ticked; rows held for a check do not.
//  Correct a figure against the photo, tick it, save. Saving submits the
//  values for verification — the shift's own Verify step still follows.
// ══════════════════════════════════════════════════════════════════

function usePhotoUrl(slipId: string, page: number) {
  const { data: blob, isError } = useQuery({
    queryKey: ["production-slip-photo", slipId, page],
    queryFn: () => slipService.photo(slipId, page),
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return { url, isError, isPdf: blob?.type === "application/pdf" };
}

function PhotoPane({ slip }: { slip: Slip }) {
  const pages = slip.photos ?? [];
  const [page, setPage] = useState(0);
  const { url, isError, isPdf } = usePhotoUrl(slip.id, page);
  if (!pages.length) {
    return <p className="p-4 text-sm text-ink-400">{isReading(slip) ? "Fetching the photo…" : "No photo kept."}</p>;
  }
  return (
    <div className="space-y-2">
      <div className="overflow-auto rounded-lg bg-ink-100" style={{ maxHeight: "70vh" }}>
        {isError ? (
          <p className="p-4 text-sm text-status-danger">The photo could not be loaded.</p>
        ) : !url ? (
          <Skeleton className="h-96 w-full" />
        ) : isPdf ? (
          <a href={url} target="_blank" rel="noreferrer" className="block p-4 text-sm text-brand-600 underline">
            Open the PDF
          </a>
        ) : (
          <a href={url} target="_blank" rel="noreferrer" title="Open full size">
            <img src={url} alt={`Slip page ${page + 1}`} className="w-full" />
          </a>
        )}
      </div>
      {pages.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Slip pages">
          {pages.map((p) => (
            <button
              key={p.page}
              type="button"
              role="tab"
              aria-selected={p.page === page}
              onClick={() => setPage(p.page)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums",
                p.page === page ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-600"
              )}
            >
              Page {p.page + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShiftPicker({ slip, prominent }: { slip: Slip; prominent: boolean }) {
  const { toast } = useToast();
  const { setShift } = useSlipMutations();
  const [dateKey, setDateKey] = useState(slip.dateKey ?? "");
  const [shift, setShiftValue] = useState<Shift | "">(slip.shift ?? "");
  const [open, setOpen] = useState(prominent);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-brand-600 hover:underline">
        Wrong shift?
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input label="Date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
      <Select
        label="Shift"
        value={shift}
        onChange={(e) => setShiftValue(e.target.value as Shift | "")}
        placeholder="Choose"
        options={[{ value: "DAY", label: "Day" }, { value: "NIGHT", label: "Night" }]}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={!dateKey || !shift}
        loading={setShift.isPending}
        onClick={() =>
          setShift.mutate(
            { id: slip.id, dateKey, shift: shift as Shift },
            {
              onSuccess: (s) => toast(s.status === "ready" ? "Matched to that shift" : s.problem ?? "Not matched", s.status === "ready" ? "success" : "error"),
              onError: (e) => toast(e instanceof ApiError ? e.message : "Could not change the shift", "error"),
            }
          )
        }
      >
        Match to this shift
      </Button>
    </div>
  );
}

function RowStatus({ row }: { row: SlipRow }) {
  if (row.applied) {
    return <StatusChip tone="success">Saved{row.appliedProduction != null ? ` · ${row.appliedProduction} m` : ""}</StatusChip>;
  }
  if (row.state === "ready") return <StatusChip tone="info">Clear</StatusChip>;
  return (
    <div className="space-y-0.5">
      <StatusChip tone={row.state === "skip" ? "neutral" : "warning"}>{row.state === "skip" ? "Skipped" : "Check"}</StatusChip>
      {row.notes.map((n) => <p key={n} className="text-xs text-ink-600">{n}</p>)}
    </div>
  );
}

function RowsTable({ slip, edits, setEdit }: {
  slip: Slip;
  edits: SlipEdit[];
  setEdit: (index: number, patch: Partial<SlipEdit>) => void;
}) {
  const rows = slip.rows ?? [];
  const canEdit = slip.status === "ready";
  return (
    <TableScroll>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
            <th className="py-2 pr-2">Save</th>
            <th className="py-2 pr-2">Loom</th>
            <th className="py-2 pr-2 text-right">Metres a head</th>
            <th className="py-2 pr-2">Run time</th>
            <th className="py-2 pr-2">Remarks</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const e = edits[r.index];
            const problem = e ? editProblem(e) : null;
            const live = canEdit && editable(r) && !!e;
            return (
              <tr key={r.index} className={cn("border-b border-ink-100 align-top", r.state === "skip" && "text-ink-400")}>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    aria-label={`Save ${r.machineID ?? "row"}`}
                    checked={!!e?.include && live}
                    disabled={!live}
                    onChange={(ev) => setEdit(r.index, { include: ev.target.checked })}
                    className="h-4 w-4"
                  />
                </td>
                <td className="py-2 pr-2">
                  <p className="font-medium">{r.machineID ?? "—"}</p>
                  <p className="text-xs text-ink-400">
                    {[r.operator, r.jobNo].filter(Boolean).join(" · ")}
                    {r.machineRead && r.machineRead !== r.machineID ? ` · written “${r.machineRead}”` : ""}
                  </p>
                </td>
                <td className="py-2 pr-2 text-right">
                  {live ? (
                    <Input
                      aria-label={`Metres for ${r.machineID}`}
                      inputMode="numeric"
                      value={String(e.production ?? "")}
                      onChange={(ev) => setEdit(r.index, { production: ev.target.value, include: true })}
                      error={problem && problem.startsWith("Metres") ? problem : undefined}
                      className="w-24 text-right tabular-nums"
                    />
                  ) : (
                    <span className="tabular-nums">{r.production ?? "—"}</span>
                  )}
                  {r.expected && (
                    <p className="mt-0.5 text-xs text-ink-400 tabular-nums">
                      usual {Math.round(r.expected.low)}–{Math.round(r.expected.high)}
                    </p>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {live ? (
                    <Input
                      aria-label={`Run time for ${r.machineID}`}
                      value={e.timer ?? ""}
                      placeholder="7:45:00"
                      onChange={(ev) => setEdit(r.index, { timer: ev.target.value, include: true })}
                      error={problem && problem.startsWith("Run") ? problem : undefined}
                      className="w-24 tabular-nums"
                    />
                  ) : (
                    <span className="tabular-nums">{r.timer ?? "—"}</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {live ? (
                    <Input
                      aria-label={`Remarks for ${r.machineID}`}
                      value={e.remarks}
                      onChange={(ev) => setEdit(r.index, { remarks: ev.target.value })}
                      className="min-w-32"
                    />
                  ) : (
                    r.remarks || "—"
                  )}
                </td>
                <td className="py-2"><RowStatus row={r} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}

export function SlipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: slip, isLoading, isError, error } = useSlip(id);
  const { apply, discard } = useSlipMutations();
  const [edits, setEdits] = useState<SlipEdit[]>([]);
  const [confirmDrop, setConfirmDrop] = useState(false);

  // Fresh edits only when the slip itself changes (read, re-matched,
  // saved) — not on a refetch, or coming back from WhatsApp to this tab
  // would wipe the corrections half made.
  const changeKey = slip ? `${slip.id}:${slip.version}:${slip.status}:${slip.rows?.length ?? 0}` : "";
  useEffect(() => {
    if (slip?.rows) setEdits(initialEdits(slip.rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeKey]);

  const setEdit = (index: number, patch: Partial<SlipEdit>) =>
    setEdits((all) => all.map((e) => (e.index === index ? { ...e, ...patch } : e)));

  const chosen = useMemo(() => edits.filter((e) => e.include), [edits]);
  const problems = chosen.map(editProblem).filter(Boolean);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>;
  }
  if (isError || !slip) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Slip not found"}
      </p>
    );
  }

  const anySaved = (slip.rows ?? []).some((r) => r.applied);
  const canDrop = ["received", "reading", "ready", "failed"].includes(slip.status) && !anySaved;

  const save = () =>
    apply.mutate(
      { id: slip.id, rows: chosen, version: slip.version },
      {
        onSuccess: (out) => {
          const skipped = out.skipped.length ? ` ${out.skipped.length} skipped: ${out.skipped.map((s) => s.reason).join("; ")}.` : "";
          toast(
            `Saved ${out.saved} loom${out.saved === 1 ? "" : "s"}. They now wait on Shift Verification.${skipped}`,
            out.skipped.length ? "error" : "success"
          );
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save", "error"),
      }
    );

  return (
    <>
      <Link to="/production-slips" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Production slips
      </Link>
      <PageHeader
        title={`Slip #${slip.confirmCode}`}
        subtitle={[
          shiftTitle(slip),
          slip.dateFrom ? DATE_FROM[slip.dateFrom] : null,
          slip.sentByName ? `sent by ${slip.sentByName}${slip.source === "whatsapp" ? " on WhatsApp" : ""}` : null,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <StatusChip tone={statusTone[slip.status]}>{statusLabel[slip.status]}</StatusChip>
            {canDrop && (
              <Button variant="secondary" onClick={() => setConfirmDrop(true)}>
                <Trash2 className="h-4 w-4" /> Drop
              </Button>
            )}
          </>
        }
      />

      {isReading(slip) && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the photo. This usually takes under a minute.
        </p>
      )}
      {slip.status === "failed" && slip.problem && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {slip.problem}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="p-3">
          <PhotoPane slip={slip} />
        </Card>

        <div className="space-y-4">
          {(slip.status === "failed" || (slip.status === "ready" && !anySaved)) && (slip.rows?.length || slip.status === "failed") ? (
            <Card className="p-4">
              <ShiftPicker key={`${slip.id}-${slip.version}`} slip={slip} prominent={slip.status === "failed"} />
            </Card>
          ) : null}

          {(slip.rows?.length ?? 0) > 0 && (
            <Card className="p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Looms read</h2>
                <span className="text-xs text-ink-400 tabular-nums">{countsSummary(slip.counts)}</span>
              </div>
              <RowsTable slip={slip} edits={edits} setEdit={setEdit} />
              {slip.status === "ready" && (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                  {problems.length > 0 && <span className="text-xs text-status-danger">Fix the marked rows first.</span>}
                  <Button loading={apply.isPending} disabled={!chosen.length || problems.length > 0} onClick={save}>
                    <Check className="h-4 w-4" /> Save {chosen.length} as submitted
                  </Button>
                </div>
              )}
            </Card>
          )}

          {(slip.unmatched?.length ?? 0) > 0 && (
            <Card className="p-4">
              <h2 className="mb-1 text-sm font-semibold">Not in this shift&apos;s plan</h2>
              <p className="mb-2 text-xs text-ink-400">
                Read from the slip but no loom like it was planned for this shift. Add it to the plan,
                or enter it by hand, if it ran.
              </p>
              <ul className="space-y-1 text-sm">
                {slip.unmatched!.map((u, i) => (
                  <li key={i} className="tabular-nums">
                    <span className="font-medium">{u.machineRead || u.code || "?"}</span>
                    {u.production != null ? ` · ${u.production} m` : ""}
                    {u.timer ? ` · ${u.timer}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDrop}
        title={`Drop slip #${slip.confirmCode}?`}
        message="Nothing from it has been saved, and nothing will be. The photo stays on record."
        confirmLabel="Drop slip"
        danger
        loading={discard.isPending}
        onCancel={() => setConfirmDrop(false)}
        onConfirm={() =>
          discard.mutate(slip.id, {
            onSuccess: () => { setConfirmDrop(false); toast("Slip dropped", "success"); },
            onError: (e) => { setConfirmDrop(false); toast(e instanceof ApiError ? e.message : "Could not drop", "error"); },
          })
        }
      />
    </>
  );
}
