import { useState } from "react";
import { Pencil, GraduationCap, Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useEmployeeMutations } from "./hooks";
import { SkillProfileFields } from "./SkillProfileFields";
import { SKILL_KEYS, SKILL_LEVEL_LABELS, SkillLevel, SkillProfile } from "./types";

const levelTone: Record<SkillLevel, ChipTone> = {
  not_known: "neutral",
  basic: "warning",
  good: "info",
  expert: "success",
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-canvas p-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

/**
 * Displays the operator's skill & performance questionnaire on the
 * employee detail page, with an Edit screen (admin/finance) that saves
 * only the skillProfile via the standard employee update.
 */
export function SkillProfileCard({
  empId,
  profile,
}: {
  empId: string;
  profile: SkillProfile | null | undefined;
}) {
  const { toast } = useToast();
  const { update } = useEmployeeMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<SkillProfile>(profile ?? {});

  const p = profile ?? {};
  const hasAny =
    !!p.machineType || !!p.yearsOfExperience || !!p.skills || !!p.knotting || !!p.production;

  const save = () =>
    update.mutate(
      { id: empId, body: { skillProfile: draft } },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast("Skill profile updated", "success");
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Update failed", "error"),
      }
    );

  const sup = p.supervisor;

  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <GraduationCap className="h-4 w-4 text-brand-500" /> Skill profile
        </h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setDraft(p);
            setEditOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" /> Edit skills
        </Button>
      </div>

      {!hasAny ? (
        <p className="mt-3 text-sm text-ink-400">
          No questionnaire on file — use “Edit skills” to fill it in.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Machine type" value={p.machineType || "—"} />
            <Fact
              label="Experience"
              value={p.yearsOfExperience != null ? `${p.yearsOfExperience} yrs` : "—"}
            />
            <Fact
              label="Knotting"
              value={
                p.knotting?.time100YarnsMin != null
                  ? `${p.knotting.time100YarnsMin} min / 100 yarns${p.knotting.quality ? ` · ${p.knotting.quality}` : ""}`
                  : p.knotting?.quality || "—"
              }
            />
            <Fact
              label="Production"
              value={
                p.production?.minPerShift != null
                  ? `${p.production.minPerShift}/shift · ${p.production.avgEfficiencyPct ?? "—"}% eff · ${p.production.machinesSimultaneous ?? "—"} mc`
                  : "—"
              }
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {SKILL_KEYS.map(([key, label]) => {
              const lvl = (p.skills?.[key] ?? "not_known") as SkillLevel;
              return (
                <StatusChip key={key} tone={levelTone[lvl]}>
                  {label}: {SKILL_LEVEL_LABELS[lvl]}
                </StatusChip>
              );
            })}
          </div>

          {sup && (sup.skillLevel || sup.machineEfficiency || sup.problemSolving || sup.discipline) && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["Skill level", sup.skillLevel],
                  ["Machine efficiency", sup.machineEfficiency],
                  ["Problem solving", sup.problemSolving],
                  ["Discipline", sup.discipline],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="rounded-lg border border-ink-100 p-3">
                  <p className="text-xs text-ink-400">{label}</p>
                  <p className="flex items-center gap-1 text-sm font-semibold">
                    {v ?? "—"}
                    {v != null && <Star className="h-3.5 w-3.5 fill-status-warning text-status-warning" />}
                    <span className="text-xs font-normal text-ink-400">/ 5</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <FormScreen
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit skill profile"
        width="max-w-2xl"
      >
        <div className="space-y-4">
          <SkillProfileFields value={draft} onChange={setDraft} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" loading={update.isPending} onClick={save}>
              Save skills
            </Button>
          </div>
        </div>
      </FormScreen>
    </Card>
  );
}
