import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BrainCircuit, RefreshCw, ShieldCheck, ShieldAlert, AlertTriangle, KeyRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { FilterChips } from "@/components/ui/FilterChips";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { aiHealthService, SURFACE_LABELS, SurfaceStats } from "./api";

type Window = "7" | "30" | "90";

// ── How a rate is coloured ────────────────────────────────────────
//
// Deliberately generous bands. This page exists to start a conversation
// about a surface, not to grade one: an OCR at 82% clean acceptance is
// doing real work, and painting it red would push somebody to "fix" a
// feature that is saving hours a week.
function rateTone(pct: number | null): "success" | "warning" | "danger" | "neutral" {
  if (pct == null) return "neutral";
  if (pct >= 85) return "success";
  if (pct >= 60) return "warning";
  return "danger";
}

/**
 * A percentage, or an honest absence of one.
 *
 * "0%" and "nobody has decided yet" are different claims and only one of
 * them is ever true here. Printing a zero for an unreviewed surface is
 * the single most misleading thing this page could do.
 */
function Rate({ pct, decided }: { pct: number | null; decided: number }) {
  if (decided === 0) {
    return <span className="text-ink-400 text-sm">not reviewed yet</span>;
  }
  return (
    <span className="tabular-nums font-semibold">
      {pct}%
      <span className="ml-1 font-normal text-xs text-ink-400">of {decided}</span>
    </span>
  );
}

function SurfaceRow({ s }: { s: SurfaceStats }) {
  const meta = SURFACE_LABELS[s.surface] ?? { label: s.surface, blurb: "" };
  const failRate = s.total > 0 ? Math.round((s.failed / s.total) * 100) : 0;

  return (
    <tr className="border-t border-ink-100 align-top">
      <td className="py-3 pr-4">
        <div className="font-medium">{meta.label}</div>
        {meta.blurb && <div className="mt-0.5 max-w-md text-xs text-ink-400">{meta.blurb}</div>}
      </td>
      <td className="py-3 pr-4 tabular-nums">{s.total}</td>
      <td className="py-3 pr-4">
        {s.decided === 0 ? (
          <Rate pct={s.acceptRate} decided={0} />
        ) : (
          <StatusChip tone={rateTone(s.acceptRate)}>{`${s.acceptRate}% of ${s.decided}`}</StatusChip>
        )}
      </td>
      <td className="py-3 pr-4">
        <Rate pct={s.usefulRate} decided={s.decided} />
      </td>
      <td className="py-3 pr-4 tabular-nums text-ink-500">
        {s.edited > 0 ? s.edited : <span className="text-ink-300">—</span>}
      </td>
      <td className="py-3 pr-4 tabular-nums">
        {s.failed > 0 ? (
          <span className={failRate >= 10 ? "text-status-danger font-semibold" : "text-ink-500"}>
            {s.failed} <span className="text-xs font-normal">({failRate}%)</span>
          </span>
        ) : (
          <span className="text-ink-300">—</span>
        )}
      </td>
      <td className="py-3 pr-4 tabular-nums text-ink-500">
        {s.pending > 0 ? s.pending : <span className="text-ink-300">—</span>}
      </td>
      <td className="py-3 pr-4 tabular-nums text-ink-500">
        {s.avgLatencyMs != null ? `${(s.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
      </td>
      <td className="py-3 tabular-nums text-ink-500 whitespace-nowrap">
        {((s.tokens.input + s.tokens.output) / 1000).toFixed(1)}k
      </td>
    </tr>
  );
}

export function AiHealthPage() {
  const [days, setDays] = useState<Window>("30");

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["ai-health", days],
    queryFn: () => aiHealthService.get(Number(days)),
    staleTime: 30_000,
  });

  const surfaces = data?.surfaces ?? [];
  const weakest = data?.weakestFields ?? [];
  const anyDecided = surfaces.some((s) => s.decided > 0);

  return (
    <>
      <PageHeader
        title="AI health"
        subtitle="What each AI feature suggested, what a person did about it, and what it cost. Every number here counts only suggestions somebody has actually decided on."
        actions={
          <>
            <FilterChips<Window>
              options={[
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ]}
              value={days}
              onChange={setDays}
            />
            <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />

      {error && (
        <ErrorBanner
          message={
            error instanceof ApiError && error.status === 403
              ? "This report is admin-only."
              : error instanceof ApiError
                ? error.message
                : "Couldn't load the AI health report."
          }
        />
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !data ? null : (
        <div className="space-y-4">
          {/* ── No key: say so first, because every zero below follows
                from it and would otherwise read as a broken model. ── */}
          {!data.configured && (
            <Card className="flex items-start gap-3 border border-status-warning/30 bg-status-warningBg/40 p-4">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
              <div className="text-sm">
                <div className="font-semibold text-status-warning">No API key on this server</div>
                <p className="mt-0.5 text-ink-500">
                  Every AI feature is switched off, and the counts below are history rather
                  than a live picture. Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> in{" "}
                  <code className="font-mono text-xs">config/.env</code> and restart.
                </p>
              </div>
            </Card>
          )}

          {data.status === "degraded" && (
            <Card className="flex items-start gap-3 border border-status-danger/30 bg-status-dangerBg/40 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-danger" />
              <div className="text-sm">
                <div className="font-semibold text-status-danger">Usage figures unavailable</div>
                <p className="mt-0.5 text-ink-500">
                  The models and prompt versions below are current, but the suggestion ledger
                  could not be read: {data.ledgerError}
                </p>
              </div>
            </Card>
          )}

          {/* ── Models ── */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
              Models in use
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([["Text", data.models.text], ["Vision", data.models.vision]] as const).map(
                ([label, m]) => (
                  <div key={label} className="rounded-lg border border-ink-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                        {label}
                      </span>
                      <StatusChip tone={m.pinned ? "success" : "warning"}>
                        {m.pinned ? "pinned" : "alias"}
                      </StatusChip>
                    </div>
                    <div className="mt-1 break-all font-mono text-sm">{m.id}</div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-400">
                      {m.pinned ? (
                        <>
                          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" />
                          A dated snapshot. It changes only when somebody here changes it.
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
                          Resolves to whatever snapshot is current upstream, so accuracy can
                          shift with no deploy on our side. Pin it in{" "}
                          <code className="font-mono">config/.env</code> once a dated version
                          you want is published.
                        </>
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </Card>

          {/* ── Usage ── */}
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
                Agreement, last {data.windowDays} days
              </h2>
              <p className="text-xs text-ink-400">
                “Clean” is applied with nothing changed. “Useful” counts the ones a person
                edited too — worth having, even with a touch.
              </p>
            </div>

            {surfaces.length === 0 ? (
              <EmptyState
                icon={<BrainCircuit className="h-12 w-12" />}
                title="No AI activity in this window"
                description="Nothing has been suggested in the last period. Try a longer window, or check that the features are switched on."
              />
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="pb-2 pr-4 font-medium">Feature</th>
                      <th className="pb-2 pr-4 font-medium">Suggestions</th>
                      <th className="pb-2 pr-4 font-medium">Clean</th>
                      <th className="pb-2 pr-4 font-medium">Useful</th>
                      <th className="pb-2 pr-4 font-medium">Edited</th>
                      <th className="pb-2 pr-4 font-medium">Failed</th>
                      <th className="pb-2 pr-4 font-medium">Awaiting</th>
                      <th className="pb-2 pr-4 font-medium">Latency</th>
                      <th className="pb-2 font-medium">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surfaces.map((s) => (
                      <SurfaceRow key={s.surface} s={s} />
                    ))}
                  </tbody>
                </table>

                {!anyDecided && (
                  <p className="mt-3 text-xs text-ink-400">
                    Nothing in this window has been decided on yet, so there is no agreement
                    to report. A rate appears once somebody applies or overrides a suggestion.
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* ── Where the model needs a human ── */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
              What people keep having to correct
            </h2>
            <p className="mt-1 text-xs text-ink-400">
              Counted per suggestion, not per cell — “one sheet in three needs the timer
              column fixed”, rather than a tally of individual corrections.
            </p>

            {weakest.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">
                Nothing has needed correcting in this window.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {weakest.map((w) => (
                  <li
                    key={`${w.surface}.${w.field}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{w.field}</div>
                      <div className="text-xs text-ink-400">
                        {SURFACE_LABELS[w.surface]?.label ?? w.surface}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm tabular-nums text-ink-500">
                      {w.suggestions} suggestion{w.suggestions === 1 ? "" : "s"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── Prompt versions ── */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
              Prompt versions
            </h2>
            <p className="mt-1 text-xs text-ink-400">
              A prompt edit changes what every user sees, immediately. Versions are stamped on
              every suggestion, so a drop above can be checked against a change here.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(data.prompts).map(([surface, version]) => (
                <span
                  key={surface}
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-1.5 text-sm"
                >
                  {SURFACE_LABELS[surface]?.label ?? surface}
                  <span className="font-mono text-xs text-ink-400">{version}</span>
                </span>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default AiHealthPage;
