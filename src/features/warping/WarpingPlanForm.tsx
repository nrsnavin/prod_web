import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Merge, Plus, Trash2, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useWarpYarnOptions, useWarpingMutations } from "./hooks";
import { combineBeams, separateBeam, totalEnds } from "./beamCombine";

const sectionSchema = z.object({
  warpYarn: z.string().min(1, "Yarn required"),
  ends: z.coerce.number().positive("Ends > 0"),
  maxMeters: z.coerce.number().min(0).optional(),
});
const schema = z.object({
  remarks: z.string().optional(),
  beams: z
    .array(
      z.object({
        beamNo: z.coerce.number().optional(),
        // Set when this beam is run together with another; see beamCombine.ts.
        pairedBeamNo: z.coerce.number().nullable().optional(),
        sections: z.array(sectionSchema).min(1),
      })
    )
    .min(1, "Add at least one beam"),
});
type PlanValues = z.infer<typeof schema>;

export function WarpingPlanForm({
  warpingId,
  jobId,
  onDone,
  onCancel,
}: {
  warpingId: string;
  jobId: string | undefined;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const yarns = useWarpYarnOptions(jobId);
  const { createPlan } = useWarpingMutations();

  const {
    register,
    control,
    handleSubmit,
    getValues,
    watch,
    formState: { errors },
  } = useForm<PlanValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      remarks: "",
      beams: [{ sections: [{ warpYarn: "", ends: 0, maxMeters: 0 }] }],
    },
  });
  const beams = useFieldArray({ control, name: "beams" });

  const yarnOptions = (yarns.data ?? []).map((y) => ({ value: y.id, label: y.name }));

  // ── Combine mode ────────────────────────────────────────────────
  // Pick two beams and they are run together: both end up carrying every
  // section from both, with each section's ends split down the middle.
  const [combining, setCombining] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);

  const exitCombine = () => { setCombining(false); setPicked([]); };

  const pickBeam = (index: number) => {
    if (picked.includes(index)) {
      setPicked(picked.filter((i) => i !== index));
      return;
    }
    const next = [...picked, index];
    if (next.length < 2) { setPicked(next); return; }

    const [i, j] = next;
    const current = getValues("beams");
    // beamNo is assigned from position here so the pairing has stable numbers
    // to refer to — the form does not otherwise ask the user for one.
    const numbered = current.map((b, k) => ({ ...b, beamNo: b.beamNo ?? k + 1 }));
    beams.replace(combineBeams(numbered, i, j));
    exitCombine();
    toast(`Beam ${i + 1} + Beam ${j + 1} combined — ends split across both`, "success");
  };

  const unpair = (index: number) => {
    beams.replace(separateBeam(getValues("beams"), index));
    toast("Beams separated", "success");
  };

  const watched = watch("beams");

  return (
    <form
      onSubmit={handleSubmit((values) =>
        createPlan.mutate(
          {
            warpingId,
            // Number every beam on the way out, not just the combined ones,
            // so the saved plan is self-describing.
            beams: values.beams.map((b, i) => ({
              ...b,
              beamNo: b.beamNo ?? i + 1,
              pairedBeamNo: b.pairedBeamNo ?? null,
            })),
            remarks: values.remarks,
          },
          {
            onSuccess: () => {
              toast("Warping plan created", "success");
              onDone();
            },
            onError: (e) =>
              toast(e instanceof ApiError ? e.message : "Failed to create plan", "error"),
          }
        )
      )}
      className="space-y-4"
      noValidate
    >
      {combining && (
        <div className="flex items-center gap-2 rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info">
          <Merge className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Pick two beams to run together. Every section from both goes onto
            both beams, with each section&apos;s ends split down the middle.
            {picked.length === 1 && " One more to go."}
          </span>
          <button
            type="button"
            onClick={exitCombine}
            aria-label="Cancel combining"
            className="rounded p-1 hover:bg-status-info/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {beams.fields.map((beam, bi) => (
        <BeamFields
          key={beam.id}
          index={bi}
          control={control}
          register={register}
          errors={errors}
          yarnOptions={yarnOptions}
          onRemove={beams.fields.length > 1 ? () => beams.remove(bi) : undefined}
          combining={combining}
          picked={picked.includes(bi)}
          onPick={() => pickBeam(bi)}
          pairedWith={watched?.[bi]?.pairedBeamNo ?? null}
          endsTotal={totalEnds({ sections: watched?.[bi]?.sections ?? [] })}
          onUnpair={() => unpair(bi)}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => beams.append({ sections: [{ warpYarn: "", ends: 0, maxMeters: 0 }] })}
        >
          <Plus className="h-4 w-4" /> Add beam
        </Button>
        {beams.fields.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => (combining ? exitCombine() : setCombining(true))}
          >
            <Merge className="h-4 w-4" /> {combining ? "Cancel combine" : "Combine beams"}
          </Button>
        )}
      </div>

      <Input label="Remarks" {...register("remarks")} />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={createPlan.isPending}>Create plan</Button>
      </div>
    </form>
  );
}

// One beam: its sections as a field array. Kept as a child component so
// each beam manages its own useFieldArray hook cleanly.
import { Control, UseFormRegister, FieldErrors } from "react-hook-form";

function BeamFields({
  index,
  control,
  register,
  errors,
  yarnOptions,
  onRemove,
  combining,
  picked,
  onPick,
  pairedWith,
  endsTotal,
  onUnpair,
}: {
  index: number;
  control: Control<PlanValues>;
  register: UseFormRegister<PlanValues>;
  errors: FieldErrors<PlanValues>;
  yarnOptions: { value: string; label: string }[];
  onRemove?: () => void;
  combining: boolean;
  picked: boolean;
  onPick: () => void;
  pairedWith: number | null;
  endsTotal: number;
  onUnpair: () => void;
}) {
  const sections = useFieldArray({ control, name: `beams.${index}.sections` });
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        picked ? "border-brand-500 ring-2 ring-brand-500/25" : "border-ink-200"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {combining && (
          <input
            type="checkbox"
            checked={picked}
            onChange={onPick}
            aria-label={`Select beam ${index + 1} to combine`}
            className="h-4 w-4 accent-brand-500"
          />
        )}
        <p className="text-sm font-semibold">Beam {index + 1}</p>
        <span className="text-xs text-ink-400 tabular-nums">
          {endsTotal.toLocaleString("en-IN")} ends
        </span>
        {pairedWith != null && (
          <>
            <StatusChip tone="info">run with beam {pairedWith}</StatusChip>
            <button
              type="button"
              onClick={onUnpair}
              className="inline-flex items-center gap-1 rounded p-1 text-xs text-ink-400 hover:text-ink-900"
              aria-label={`Separate beam ${index + 1} from beam ${pairedWith}`}
              title="Separate — leaves the ends as they were split"
            >
              <Unlink className="h-3.5 w-3.5" /> Separate
            </button>
          </>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto p-1 rounded text-ink-400 hover:text-status-danger"
            aria-label={`Remove beam ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-[1fr_90px_90px_32px] gap-2 px-1 pb-1 text-xs font-medium text-ink-400"><span>Warp yarn</span><span>Ends</span><span>Length</span><span className="sr-only">Remove</span></div>
      <div className="space-y-2">
        {sections.fields.map((s, si) => (
          <div key={s.id} className="grid grid-cols-[1fr_90px_90px_32px] gap-2 items-start">
            <Select aria-label="Warp yarn"
              placeholder="Warp yarn"
              options={yarnOptions}
              error={errors.beams?.[index]?.sections?.[si]?.warpYarn?.message}
              {...register(`beams.${index}.sections.${si}.warpYarn`)}
            />
            <Input aria-label="Ends"
              type="number"
              placeholder="Ends"
              error={errors.beams?.[index]?.sections?.[si]?.ends?.message}
              {...register(`beams.${index}.sections.${si}.ends`)}
            />
            <Input aria-label="Length" type="number" placeholder="Length" {...register(`beams.${index}.sections.${si}.maxMeters`)} />
            <button
              type="button"
              onClick={() => sections.fields.length > 1 && sections.remove(si)}
              className="h-10 grid place-items-center rounded-lg text-ink-400 hover:text-status-danger disabled:opacity-40"
              disabled={sections.fields.length <= 1}
              aria-label="Remove section"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => sections.append({ warpYarn: "", ends: 0, maxMeters: 0 })}
      >
        <Plus className="h-4 w-4" /> Add section
      </Button>
    </div>
  );
}
