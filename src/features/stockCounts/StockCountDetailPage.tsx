import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, TriangleAlert, XCircle, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { toApiError } from "@/core/http/httpClient";
import { useStockCount, useStockCountMutations } from "./hooks";
import { STATUS_LABEL, STATUS_TONE, StockCountLine } from "./types";

const money = (v: number) =>
  `${v < 0 ? "−" : ""}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;

const qty = (v: number) =>
  v.toLocaleString("en-IN", { maximumFractionDigits: 3 });

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${qty(Math.abs(v))}`;

type Lens = "all" | "todo" | "varied" | "attention";

const LENSES: Array<{ value: Lens; label: string }> = [
  { value: "all", label: "All lines" },
  { value: "todo", label: "Not counted" },
  { value: "varied", label: "Differences" },
  { value: "attention", label: "Needs a reason" },
];

export function StockCountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: count, isLoading, isError, error } = useStockCount(id);
  const { enter, post, cancel } = useStockCountMutations(id);

  const [lens, setLens] = useState<Lens>("all");
  const [search, setSearch] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  // The server's objection to a partial post, held so it can be shown
  // in a real dialog with the lines it is about — see below.
  const [postObjection, setPostObjection] = useState<string | null>(null);

  // Local edits, keyed by line. The sheet is keyed in from paper one row
  // at a time and each row is saved on blur, so this holds only what has
  // been typed but not yet committed — never the whole sheet's state,
  // which stays the server's.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});

  // A different count means different drafts. Without this, navigating
  // between two sheets carries one's half-typed rows onto the other.
  useEffect(() => {
    setDraft({});
    setReasonDraft({});
  }, [id]);

  const closed = count?.status === "posted" || count?.status === "cancelled";

  const rows = useMemo(() => {
    if (!count) return [];
    const q = search.trim().toLowerCase();
    return count.lines.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q)) return false;
      if (lens === "todo") return l.countedQty === null;
      if (lens === "varied") return l.variance !== null && l.variance !== 0;
      if (lens === "attention") return l.needsReason;
      return true;
    });
  }, [count, search, lens]);

  const save = async (line: StockCountLine, patch: { countedQty?: number | null; reason?: string }) => {
    try {
      await enter.mutateAsync([{ lineId: line._id, ...patch }]);
    } catch (err) {
      toast(toApiError(err).message, "error");
    }
  };

  const commitCount = (line: StockCountLine) => {
    const raw = draft[line._id];
    if (raw === undefined) return;
    setDraft((d) => {
      const next = { ...d };
      delete next[line._id];
      return next;
    });

    // Empty clears the line back to uncounted. That is a real state —
    // "nobody has been to that rack" — and the server refuses to write
    // off a line in it, so it must be reachable from the keyboard.
    if (raw.trim() === "") {
      if (line.countedQty !== null) void save(line, { countedQty: null });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast("A counted quantity must be zero or more", "error");
      return;
    }
    if (n === line.countedQty) return;
    void save(line, { countedQty: n });
  };

  const doPost = async (force: boolean) => {
    try {
      const posted = await post.mutateAsync(force);
      const s = posted.postedSummary;
      toast(
        s && s.linesVaried > 0
          ? `Count #${posted.countNo} posted — ${s.linesVaried} line(s) corrected, net ${money(s.netValue)}`
          : `Count #${posted.countNo} posted — everything matched`,
        "success"
      );
    } catch (err) {
      const e = toApiError(err);
      // The server refuses a partial post unless asked twice. Rather
      // than a second button nobody understands, ask here, in the words
      // it used.
      if (!force && /have not been counted/i.test(e.message)) {
        // Was a native window.confirm. A stock posting the server has
        // already objected to, offered as an override, in an unstyled
        // OS dialog that cannot show the lines in question and cannot
        // be branded, tested or made accessible — the weight of the
        // interface and the weight of the moment disagreed completely.
        setPostObjection(e.message);
        return;
      }
      toast(e.message, "error");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !count) {
    return <ErrorBanner message={(error as Error)?.message ?? "Could not load this stock count"} />;
  }

  const t = count.totals;
  // Named here so the override dialog can list them rather than only
  // count them — "12 lines were not counted" does not tell anybody
  // whether the ones that matter are among them.
  const uncountedLines = (count.lines ?? []).filter((l) => l.countedQty == null);

  return (
    <>
      <PageHeader
        title={`Stock Count #${count.countNo ?? ""}`}
        subtitle={count.label || "Untitled count"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/stock-counts")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            {!closed && (
              <>
                <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                  Cancel count
                </Button>
                <Button
                  onClick={() => doPost(false)}
                  loading={post.isPending}
                  disabled={t.counted === 0}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Post
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ── Where the count stands ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        <Stat label="Status" value={<StatusChip tone={STATUS_TONE[count.status]}>{STATUS_LABEL[count.status]}</StatusChip>} />
        <Stat label="Counted" value={`${t.counted} / ${t.lines}`} muted={t.uncounted > 0} />
        <Stat label="Differences" value={String(t.varied)} />
        <Stat
          label={count.status === "posted" ? "Net posted" : "Net variance"}
          value={money(count.status === "posted" ? count.postedSummary?.netValue ?? 0 : t.netValue)}
          tone={
            (count.status === "posted" ? count.postedSummary?.netValue ?? 0 : t.netValue) < 0
              ? "danger"
              : "success"
          }
        />
      </div>

      {t.needingReason > 0 && !closed && (
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-status-warningBg px-4 py-3 text-sm text-status-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t.needingReason} line{t.needingReason === 1 ? "" : "s"} differ by more than the
            threshold and need a reason before this count can be posted. A difference that big is
            what the count is for — it just has to be explainable six months from now.
          </p>
        </div>
      )}

      {count.status === "posted" && (count.postedSummary?.linesMovedSinceFreeze ?? 0) > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-status-infoBg px-4 py-3 text-sm text-status-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {count.postedSummary?.linesMovedSinceFreeze} line
            {count.postedSummary?.linesMovedSinceFreeze === 1 ? "" : "s"} moved while this count
            was open. Your figures were applied on top of those movements, not instead of them —
            the differences you found still hold.
          </p>
        </div>
      )}

      {/* ── The sheet ──────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-56 flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Find a material" />
          </div>
          <FilterChips options={LENSES} value={lens} onChange={(v) => setLens(v as Lens)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 text-left font-medium">Material</th>
                <th className="py-2 text-right font-medium">System</th>
                <th className="py-2 text-right font-medium">Counted</th>
                <th className="py-2 text-right font-medium">Difference</th>
                <th className="py-2 text-right font-medium">Value</th>
                <th className="py-2 text-left font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((l) => {
                const value = draft[l._id] ?? (l.countedQty === null ? "" : String(l.countedQty));
                return (
                  <tr key={l._id} className={cn(l.needsReason && "bg-status-warningBg/40")}>
                    <td className="py-2 pr-3">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-ink-400">
                        {l.category || "—"} · ₹{qty(l.unitCost)}/unit
                        {l.movedSinceFreeze ? " · moved while counting" : ""}
                        {/* Without this the row reads "variance −10,
                            applied 0" and leaves the reader to guess
                            whether it was neutralised, floored at zero
                            stock, or simply not applied. */}
                        {l.correctedElsewhere
                          ? ` · ${qty(Math.abs(l.correctedElsewhere))} already corrected by another count`
                          : ""}
                      </p>
                    </td>
                    <td className="py-2 text-right tabular-nums text-ink-600">{qty(l.systemQty)}</td>
                    <td className="py-2 text-right">
                      {closed ? (
                        <span className="tabular-nums">
                          {l.countedQty === null ? <span className="text-ink-400">not counted</span> : qty(l.countedQty)}
                        </span>
                      ) : (
                        <input
                          aria-label="Counted quantity"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          className="h-9 w-28 rounded-lg border border-ink-200 bg-surface px-2 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          placeholder="—"
                          value={value}
                          onChange={(e) => setDraft((d) => ({ ...d, [l._id]: e.target.value }))}
                          onBlur={() => commitCount(l)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      )}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums font-semibold",
                        l.variance !== null && l.variance < 0 && "text-status-danger",
                        l.variance !== null && l.variance > 0 && "text-status-success"
                      )}
                    >
                      {l.variance === null ? <span className="font-normal text-ink-400">—</span> : signed(l.variance)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-ink-600">
                      {l.varianceValue === null ? "—" : money(l.varianceValue)}
                    </td>
                    <td className="py-2 pl-3">
                      {closed ? (
                        <span className="text-ink-600">{l.reason || "—"}</span>
                      ) : (
                        <Input
                          placeholder={l.needsReason ? "Required — why?" : "Optional"}
                          value={reasonDraft[l._id] ?? l.reason}
                          error={l.needsReason ? " " : undefined}
                          onChange={(e) => setReasonDraft((d) => ({ ...d, [l._id]: e.target.value }))}
                          onBlur={() => {
                            const next = reasonDraft[l._id];
                            if (next === undefined || next === l.reason) return;
                            setReasonDraft((d) => {
                              const copy = { ...d };
                              delete copy[l._id];
                              return copy;
                            });
                            void save(l, { reason: next });
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-ink-400">
                    Nothing matches that view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {!closed && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-400">
          <XCircle className="h-3.5 w-3.5" />
          Clearing a box puts the line back to “not counted”. Lines that were never counted are
          left untouched when the sheet is posted — never written off.
        </p>
      )}

      {/* The override the UX audit singled out. It now shows the
          server's objection in full AND the lines it is about — which
          is the whole question being asked, and the one thing a native
          confirm could not put on screen. */}
      <ConfirmDialog
        open={!!postObjection}
        wide
        title="Some lines were never counted"
        confirmLabel="Post the counted lines"
        onCancel={() => setPostObjection(null)}
        onConfirm={() => {
          setPostObjection(null);
          void doPost(true);
        }}
        loading={post.isPending}
        message={
          <div className="space-y-3">
            <p>{postObjection}</p>
            {uncountedLines.length > 0 && (
              <div>
                <p className="mb-1.5 font-medium text-ink-900">
                  These {uncountedLines.length} line
                  {uncountedLines.length === 1 ? "" : "s"} will be left exactly
                  as {uncountedLines.length === 1 ? "it is" : "they are"}:
                </p>
                <ul className="max-h-48 overflow-y-auto rounded-lg border border-ink-200 divide-y divide-ink-100">
                  {uncountedLines.map((l) => (
                    <li key={l._id} className="flex justify-between gap-3 px-3 py-1.5">
                      <span>{l.name}</span>
                      <span className="tabular-nums text-ink-400">
                        system {qty(l.systemQty)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-ink-500">
              Nothing is written off. An uncounted line keeps its current stock
              figure and can be counted on a later sheet.
            </p>
          </div>
        }
      />

      <ReasonDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this count"
        description="Nothing that was counted is applied. The sheet stays on record with the reason."
        confirmLabel="Cancel count"
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync(reason);
            setCancelOpen(false);
            toast("Count cancelled — no stock was moved", "info");
          } catch (err) {
            toast(toApiError(err).message, "error");
          }
        }}
      />
    </>
  );
}

function Stat({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  tone?: "danger" | "success";
}) {
  return (
    <Card className="p-3">
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          muted && "text-ink-400",
          tone === "danger" && "text-status-danger",
          tone === "success" && "text-status-success"
        )}
      >
        {value}
      </div>
    </Card>
  );
}
