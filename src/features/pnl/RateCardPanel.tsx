import { useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MAX_RATE } from "./format";
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

export function RateCardPanel() {
  const { data, isLoading } = useCostSettings();
  const { saveSettings } = usePnlMutations();
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({});

  const value = (k: FieldKey) => draft[k] ?? (data ? String(data[k]) : "");

  const save = () => {
    const body: Record<string, number> = {};
    for (const { key } of FIELDS) {
      const raw = draft[key];
      // A cleared box means "leave it alone", not "set it to zero" —
      // and this rate card re-costs every order in the factory.
      if (raw === undefined || raw.trim() === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= MAX_RATE) body[key] = n;
    }
    if (Object.keys(body).length === 0) return;
    saveSettings.mutate(body, { onSuccess: () => setDraft({}) });
  };

  const unset = data && !data.configured;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-ink-400" />
            Conversion rate card
          </h2>
          <p className="mt-0.5 text-sm text-ink-400">
            Charged per meter produced. A job that actually cost something else
            carries its own figure, which wins over these.
          </p>
        </div>
        <Button
          size="sm"
          loading={saveSettings.isPending}
          disabled={Object.keys(draft).length === 0}
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
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          />
        ))}
      </div>
    </Card>
  );
}
