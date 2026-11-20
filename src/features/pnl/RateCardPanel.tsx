import { useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/core/format/date";
import { MAX_RATE, rupeePrecise } from "./format";
import { useCostSettings, usePnlMutations } from "./hooks";

// The ₹/meter conversion rate card. Finishing, checking and packing are
// recorded nowhere else in the system, and overhead belongs to every
// meter but sits on no document — so until this is filled in, four of
// the seven cost lines are zero for every order in the factory. The
// panel says that outright rather than looking like a settings page
// nobody needs to visit.

const FIELDS = [
  { key: "finishingRatePerMeter", label: "Finishing ₹/m" },
  { key: "checkingRatePerMeter", label: "Checking ₹/m" },
  { key: "packingRatePerMeter", label: "Packing ₹/m" },
  { key: "overheadRatePerMeter", label: "Overhead ₹/m" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/** What was typed, as a rate — or null when it cannot be one. */
const asRate = (raw: string): number | null => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= MAX_RATE ? n : null;
};
const NOT_A_RATE = `A rate per metre is between 0 and ${MAX_RATE.toLocaleString("en-IN")}.`;

/** `bare` drops the card and its heading, for a panel that has its own. */
export function RateCardPanel({ bare = false }: { bare?: boolean } = {}) {
  const { data, isLoading } = useCostSettings();
  const { saveSettings } = usePnlMutations();
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({});

  const value = (k: FieldKey) => draft[k] ?? (data ? String(data[k]) : "");

  // A cleared box means "leave it alone", not "set it to zero" — and this
  // rate card re-costs every order in the factory.
  const typed = (k: FieldKey) => { const raw = draft[k]; return raw === undefined || raw.trim() === "" ? null : raw; };
  // A figure that cannot be a rate used to be left out of the save without
  // a word: the other boxes were saved, the form said so and went back to
  // the old figure in this one. Now nothing is saved until it is put right.
  const bad = (k: FieldKey) => { const raw = typed(k); return raw !== null && asRate(raw) === null; };
  const anyBad = FIELDS.some(({ key }) => bad(key));

  const save = () => {
    if (anyBad) return;
    const body: Record<string, number> = {};
    for (const { key } of FIELDS) {
      const raw = typed(key);
      if (raw !== null) body[key] = asRate(raw)!;
    }
    if (Object.keys(body).length === 0) return;
    saveSettings.mutate(body, { onSuccess: () => setDraft({}) });
  };

  const last = data?.lastChange ?? null;

  const unset = data && !data.configured;

  const Shell = bare ? "div" : Card;
  return (
    <Shell className={bare ? undefined : "p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!bare && (
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-ink-400" />
              Conversion rate card
            </h2>
          )}
          <p className="mt-0.5 text-sm text-ink-400">
            Charged per metre produced. A job that actually cost something else
            carries its own figure, which wins over these.
          </p>
        </div>
        <Button
          size="sm"
          loading={saveSettings.isPending}
          disabled={Object.keys(draft).length === 0 || anyBad}
          onClick={save}
        >
          <Save className="h-4 w-4" /> Save rate card
        </Button>
      </div>

      {unset && (
        <p className="mt-3 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          Nothing is set yet, so finishing, checking, packing and overhead are
          costing ₹0 on every order. Until you fill these in, every margin
          below is higher than the real one.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FIELDS.map(({ key, label }) => (
          <Input
            key={key}
            label={label}
            type="number"
            step="0.01"
            min="0"
            disabled={isLoading}
            value={value(key)}
            error={bad(key) ? NOT_A_RATE : undefined}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          />
        ))}
      </div>

      {/* Who moved it, and from what: these figures cost every metre ever
          made, and the card used to keep only the time of its last save. */}
      {last && (
        <p className="mt-3 text-xs text-ink-500" aria-label="Last change to the rate card">
          Last changed on {formatDate(last.at)}{last.byName ? ` by ${last.byName}` : ""}:{" "}
          {FIELDS.filter(({ key }) => last.to[key] !== undefined)
            .map(({ key, label }) => `${label.replace(" ₹/m", "")} ${rupeePrecise(last.from[key] ?? 0)} → ${rupeePrecise(last.to[key] ?? 0)}`)
            .join(" · ")}
          . Every order is costed at the figures as they stand now.
        </p>
      )}
    </Shell>
  );
}
