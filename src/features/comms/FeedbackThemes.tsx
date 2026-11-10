import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { httpClient } from "@/core/http/httpClient";
import { MODEL_TIMEOUT_MS } from "@/core/http/timeouts";

// ══════════════════════════════════════════════════════════════════
//  What the workers keep raising: exact counts always, themes once there
//  is enough to group. No names — the grouping never sees who wrote what.
// ══════════════════════════════════════════════════════════════════

interface Theme { label: string; count: number; sharePct: number; complaints: number; open: number; examples: string[] }
interface ThemesData {
  windowDays: number; total: number; byCategory: Record<string, number>; byType: { complaint: number; suggestion: number };
  unanswered: number; daysToAnswer: number | null; themes: Theme[] | null; ungrouped: number | null; note?: string;
}

export function FeedbackThemes() {
  const [days, setDays] = useState("90");
  const { data } = useQuery({
    queryKey: ["feedback", "themes", days],
    queryFn: async () => (await httpClient.get<{ data: ThemesData }>("/feedback/themes", { days }, { timeoutMs: MODEL_TIMEOUT_MS })).data,
  });
  if (!data || !data.total) return null;
  const cats = Object.entries(data.byCategory).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-brand-500" />
          <h3 className="font-semibold">What keeps coming up</h3>
        </div>
        <FilterChips options={[{ value: "90", label: "3 months" }, { value: "365", label: "A year" }]} value={days} onChange={setDays} />
      </div>
      <p className="mt-1 text-sm text-ink-600">
        {data.total} notes · {data.byType.complaint} complaints, {data.byType.suggestion} suggestions · {data.unanswered} not answered
        {data.daysToAnswer != null ? ` · answered in ${data.daysToAnswer} days on average` : ""}
      </p>
      <p className="text-xs text-ink-500">{cats.map(([c, n]) => `${c} ${n}`).join(" · ")}</p>
      {data.themes ? (
        <ul className="mt-2 space-y-1.5 text-sm">
          {data.themes.map((t) => (
            <li key={t.label}>
              <span className="font-medium">{t.label}</span>
              <span className="text-ink-500"> — {t.count} note{t.count === 1 ? "" : "s"} ({t.sharePct}%){t.open ? `, ${t.open} still open` : ""}</span>
              {t.examples.map((e, i) => <p key={i} className="ml-3 text-xs italic text-ink-500">“{e}”</p>)}
            </li>
          ))}
          {data.ungrouped ? <li className="text-xs text-ink-400">{data.ungrouped} note{data.ungrouped === 1 ? "" : "s"} fit no theme.</li> : null}
        </ul>
      ) : (
        data.note && <p className="mt-2 text-xs text-ink-500">{data.note}</p>
      )}
    </Card>
  );
}
