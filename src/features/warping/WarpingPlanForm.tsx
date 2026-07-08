import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useWarpYarnOptions, useWarpingMutations } from "./hooks";

const sectionSchema = z.object({
  warpYarn: z.string().min(1, "Yarn required"),
  ends: z.coerce.number().positive("Ends > 0"),
  length: z.coerce.number().min(0).optional(),
});
const schema = z.object({
  remarks: z.string().optional(),
  beams: z
    .array(z.object({ sections: z.array(sectionSchema).min(1) }))
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
    formState: { errors },
  } = useForm<PlanValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      remarks: "",
      beams: [{ sections: [{ warpYarn: "", ends: 0, length: 0 }] }],
    },
  });
  const beams = useFieldArray({ control, name: "beams" });

  const yarnOptions = (yarns.data ?? []).map((y) => ({ value: y.id, label: y.name }));

  return (
    <form
      onSubmit={handleSubmit((values) =>
        createPlan.mutate(
          { warpingId, beams: values.beams, remarks: values.remarks },
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
      {beams.fields.map((beam, bi) => (
        <BeamFields
          key={beam.id}
          index={bi}
          control={control}
          register={register}
          errors={errors}
          yarnOptions={yarnOptions}
          onRemove={beams.fields.length > 1 ? () => beams.remove(bi) : undefined}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => beams.append({ sections: [{ warpYarn: "", ends: 0, length: 0 }] })}
      >
        <Plus className="h-4 w-4" /> Add beam
      </Button>

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
}: {
  index: number;
  control: Control<PlanValues>;
  register: UseFormRegister<PlanValues>;
  errors: FieldErrors<PlanValues>;
  yarnOptions: { value: string; label: string }[];
  onRemove?: () => void;
}) {
  const sections = useFieldArray({ control, name: `beams.${index}.sections` });
  return (
    <div className="rounded-xl border border-ink-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold">Beam {index + 1}</p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-ink-400 hover:text-status-danger"
            aria-label={`Remove beam ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {sections.fields.map((s, si) => (
          <div key={s.id} className="grid grid-cols-[1fr_90px_90px_32px] gap-2 items-start">
            <Select
              placeholder="Warp yarn"
              options={yarnOptions}
              error={errors.beams?.[index]?.sections?.[si]?.warpYarn?.message}
              {...register(`beams.${index}.sections.${si}.warpYarn`)}
            />
            <Input
              type="number"
              placeholder="Ends"
              error={errors.beams?.[index]?.sections?.[si]?.ends?.message}
              {...register(`beams.${index}.sections.${si}.ends`)}
            />
            <Input type="number" placeholder="Length" {...register(`beams.${index}.sections.${si}.length`)} />
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
        onClick={() => sections.append({ warpYarn: "", ends: 0, length: 0 })}
      >
        <Plus className="h-4 w-4" /> Add section
      </Button>
    </div>
  );
}
