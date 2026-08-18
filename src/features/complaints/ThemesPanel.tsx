import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tags, Info, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { FilterChips } from "@/components/ui/FilterChips";
import { complaintService } from "./api";
import type { ThemesReport } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHAT THE COMPLAINTS KEEP SAYING
//
//  Two layers, and the panel keeps them visibly apart because they are
//  trustworthy to very different degrees.
//
//  The CATEGORY COUNTS are a group-by. They are exact, they work on the
//  first day, and they are on top of the panel for that reason.
//
//  The THEMES are a language model grouping prose, and below a volume
//  floor the backend refuses to produce them at all. When it refuses,
//  this panel prints the reason where the themes would have been —
//  never an empty list, because an empty list reads as "we looked and
//  found nothing", which is a different and false claim.
//
//  ── Why the share percentage is here ─────────────────────────────
//  A theme covering 3 of 25 complaints and one covering 24 of 25 look
//  identical as a label. The count and share are shown on every row so
//  the reader can size a theme without asking for the underlying rows.
//  `ungrouped` is shown for the same reason: a themes list covering
//  under half the complaints is a weak summary, and that has to be
//  visible rather than inferred.
// ══════════════════════════════════════════════════════════════════

type Window = "90" | "365" | "730";

const WINDOWS: { value: Window; label: string }[] = [
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "730", label: "2 years" },
];

function Counts({ data }: { data: ThemesReport }) {
  const entries = Object.entries(data.byCategory);
  const max = Math.max(1, ...entries.map(([, n]) => n));

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        By category
      </h3>
      <p className="mt-0.5 text-xs text-ink-400">
        A group-by over the category field. Exact, whatever the volume.
      </p>
      <ul className="mt-2 space-y-1">
        {entries.map(([cat, n]) => (
          <li key={cat} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 capitalize">{cat}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-status-info"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right tabular-nums text-ink-500">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Themes({ data }: { data: ThemesReport }) {
  // null is not []. The distinction is the whole guardrail — see header.
  if (data.themes === null) {
    return (
      <div className="mt-4 rounded-lg border border-ink-100 bg-surface-2 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
          <Sparkles className="h-3.5 w-3.5" /> Themes
        </h3>
        <p className="mt-1 text-sm text-ink-500">{data.note}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        <Sparkles className="h-3.5 w-3.5" /> Themes
        <span className="font-normal normal-case tracking-normal text-ink-400">
          over {data.sampled} complaints
        </span>
      </h3>
      <ul className="mt-2 space-y-2">
        {data.themes.map((t) => (
          <li key={t.label} className="rounded-lg border border-ink-100 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{t.label}</span>
              <span className="text-sm tabular-nums text-ink-500">
                {t.count} · {t.sharePct}%
              </span>
            </div>
            {t.examples.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {t.examples.map((ex, i) => (
                  <li key={i} className="truncate text-xs text-ink-400">— {ex}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {data.ungrouped != null && data.ungrouped > 0 && (
        <p className="mt-2 text-xs text-ink-400">
          {data.ungrouped} complaint{data.ungrouped === 1 ? "" : "s"} fell into no theme.
          A grouping that covers little of the total is a weak summary of it.
        </p>
      )}
    </div>
  );
}

export function ThemesPanel() {
  const [window, setWindow] = useState<Window>("365");

  const { data, isLoading } = useQuery({
    queryKey: ["complaint-themes", window],
    queryFn: () => complaintService.themes(Number(window)).then((r) => r.data),
    staleTime: 10 * 60_000,
  });

  return (
    <Card className="mb-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
            <Tags className="h-4 w-4" /> What keeps coming back
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-ink-400">
            Counts are exact from day one. Grouping the free text needs volume, and
            below it nothing is produced rather than something invented.
          </p>
        </div>
        <FilterChips
          options={WINDOWS}
          value={window}
          onChange={(v) => setWindow(v as Window)}
        />
      </div>

      {isLoading ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : data ? (
        <>
          <p className="mt-3 text-sm">
            <span className="text-2xl font-bold tabular-nums">{data.total}</span>
            <span className="ml-2 text-ink-400">
              complaint{data.total === 1 ? "" : "s"} in the last {data.windowDays} days
            </span>
          </p>
          {data.total > 0 && <Counts data={data} />}
          <Themes data={data} />
          {data.aiGenerated && (
            <p className="mt-3 flex items-start gap-1.5 border-t border-ink-100 pt-3 text-xs text-ink-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Themes are grouped by a language model. It assigns complaints to groups;
              every count above is worked out from that assignment, not stated by it.
            </p>
          )}
        </>
      ) : null}
    </Card>
  );
}

export default ThemesPanel;
