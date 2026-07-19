import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import { SKILL_KEYS, SKILL_LEVELS, SKILL_LEVEL_LABELS, SkillLevel, SkillProfile } from "./types";

const QUALITY_OPTIONS = [
  { value: "", label: "—" },
  { value: "poor", label: "Poor" },
  { value: "average", label: "Average" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

const num = (v: string): number | null => (v === "" ? null : Number(v));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{children}</p>
  );
}

/**
 * The onboarding "Skill & Performance Questionnaire" as form fields —
 * knotting performance, machine production performance, the 10-skill
 * knowledge grid (Not known → Expert) and the supervisor's 1–5 ratings.
 * Controlled: parent owns the SkillProfile object.
 */
export function SkillProfileFields({
  value,
  onChange,
}: {
  value: SkillProfile;
  onChange: (next: SkillProfile) => void;
}) {
  const set = (patch: Partial<SkillProfile>) => onChange({ ...value, ...patch });
  const setSkill = (key: string, level: SkillLevel) =>
    set({ skills: { ...value.skills, [key]: level } });
  const setSup = (key: string, v: string) =>
    set({ supervisor: { ...value.supervisor, [key]: v === "" ? null : Number(v) } });

  return (
    <div className="space-y-4">
      <SectionTitle>Experience</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Machine type"
          placeholder="e.g. jacquard, needle loom"
          value={value.machineType ?? ""}
          onChange={(e) => set({ machineType: e.target.value })}
        />
        <Input
          label="Years of experience"
          type="number"
          min="0"
          value={value.yearsOfExperience ?? ""}
          onChange={(e) => set({ yearsOfExperience: e.target.value === "" ? undefined : Number(e.target.value) })}
        />
      </div>

      <SectionTitle>Knotting performance</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Mins to knot 100 yarns"
          type="number"
          min="0"
          value={value.knotting?.time100YarnsMin ?? ""}
          onChange={(e) => set({ knotting: { ...value.knotting, time100YarnsMin: num(e.target.value) } })}
        />
        <Select
          label="Knotting quality"
          options={QUALITY_OPTIONS}
          value={value.knotting?.quality ?? ""}
          onChange={(e) =>
            set({
              knotting: {
                ...value.knotting,
                quality: e.target.value as NonNullable<SkillProfile["knotting"]>["quality"],
              },
            })
          }
        />
        <Input
          label="Max yarns at one time"
          type="number"
          min="0"
          value={value.knotting?.maxYarnsAtOnce ?? ""}
          onChange={(e) => set({ knotting: { ...value.knotting, maxYarnsAtOnce: num(e.target.value) } })}
        />
      </div>

      <SectionTitle>Machine production performance</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Min production / shift (m or kg)"
          type="number"
          min="0"
          value={value.production?.minPerShift ?? ""}
          onChange={(e) => set({ production: { ...value.production, minPerShift: num(e.target.value) } })}
        />
        <Input
          label="Avg machine efficiency (%)"
          type="number"
          min="0"
          max="100"
          value={value.production?.avgEfficiencyPct ?? ""}
          onChange={(e) => set({ production: { ...value.production, avgEfficiencyPct: num(e.target.value) } })}
        />
        <Input
          label="Machines handled at once"
          type="number"
          min="0"
          value={value.production?.machinesSimultaneous ?? ""}
          onChange={(e) => set({ production: { ...value.production, machinesSimultaneous: num(e.target.value) } })}
        />
      </div>

      <SectionTitle>Skill knowledge</SectionTitle>
      <div className="overflow-x-auto rounded-lg border border-ink-100">
        <table className="w-full text-sm">
          <thead className="bg-ink-100 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-3 py-2 text-left">Skill</th>
              {SKILL_LEVELS.map((l) => (
                <th key={l} className="px-2 py-2 text-center">{SKILL_LEVEL_LABELS[l]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {SKILL_KEYS.map(([key, label]) => {
              const current = value.skills?.[key] ?? "not_known";
              return (
                <tr key={key}>
                  <td className="px-3 py-1.5">{label}</td>
                  {SKILL_LEVELS.map((l) => (
                    <td key={l} className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        aria-label={`${label}: ${SKILL_LEVEL_LABELS[l]}`}
                        onClick={() => setSkill(key, l)}
                        className={cn(
                          "h-4 w-4 rounded-full border transition-colors",
                          current === l
                            ? "border-brand-500 bg-brand-500"
                            : "border-ink-300 bg-white hover:border-brand-400"
                        )}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SectionTitle>Supervisor evaluation (1–5)</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["skillLevel", "Skill level"],
            ["machineEfficiency", "Machine efficiency"],
            ["problemSolving", "Problem solving"],
            ["discipline", "Discipline"],
          ] as const
        ).map(([key, label]) => (
          <Select
            key={key}
            label={label}
            value={value.supervisor?.[key] == null ? "" : String(value.supervisor[key])}
            onChange={(e) => setSup(key, e.target.value)}
            options={[
              { value: "", label: "—" },
              ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
            ]}
          />
        ))}
      </div>
    </div>
  );
}
