import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useMaterialsByCategory } from "./hooks";
import { Elastic, ElasticFormValues, MaterialRef } from "./types";

const materialWeight = z.object({
  id: z.string().min(1, "Select material"),
  weight: z.coerce.number().positive("Weight > 0"),
});

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  weaveType: z.string().optional(),
  warpSpandex: materialWeight,
  spandexCovering: materialWeight,
  weftYarn: materialWeight,
  warpYarn: z.array(materialWeight).min(1, "Add at least one warp yarn"),
  spandexEnds: z.coerce.number().min(0).optional(),
  yarnEnds: z.coerce.number().min(0).optional(),
  pick: z.coerce.number().min(0).optional(),
  noOfHook: z.coerce.number().min(0).optional(),
  weight: z.coerce.number().min(0).optional(),
  conversionCost: z.coerce.number().min(0).optional(),
});

function refId(mw?: { id?: MaterialRef | string | null }): string {
  if (!mw?.id) return "";
  return typeof mw.id === "object" ? mw.id._id : mw.id;
}

const toOptions = (list?: MaterialRef[]) =>
  (list ?? []).map((m) => ({ value: m._id, label: m.name }));

export function ElasticForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Elastic;
  submitting: boolean;
  onSubmit: (v: ElasticFormValues) => void;
  onCancel: () => void;
}) {
  const materials = useMaterialsByCategory();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ElasticFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      weaveType: initial?.weaveType ?? "",
      warpSpandex: { id: refId(initial?.warpSpandex), weight: initial?.warpSpandex?.weight ?? 0 },
      spandexCovering: {
        id: refId(initial?.spandexCovering),
        weight: initial?.spandexCovering?.weight ?? 0,
      },
      weftYarn: { id: refId(initial?.weftYarn), weight: initial?.weftYarn?.weight ?? 0 },
      warpYarn:
        initial?.warpYarn && initial.warpYarn.length > 0
          ? initial.warpYarn.map((w) => ({ id: refId(w), weight: w.weight ?? 0 }))
          : [{ id: "", weight: 0 }],
      spandexEnds: initial?.spandexEnds ?? 0,
      yarnEnds: initial?.yarnEnds ?? 0,
      pick: initial?.pick ?? 0,
      noOfHook: initial?.noOfHook ?? 0,
      weight: initial?.weight ?? 0,
      conversionCost: initial?.conversionCost ?? initial?.costing?.conversionCost ?? 0,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "warpYarn" });

  const m = materials.data;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Elastic name *" error={errors.name?.message} {...register("name")} />
        <Input label="Weave type" placeholder="e.g. Plain" {...register("weaveType")} />
      </div>

      <p className="text-sm font-semibold text-ink-600 pt-1">Composition (weights in g/m)</p>

      <div className="grid grid-cols-[1fr_110px] gap-2">
        <Select
          label="Warp spandex *"
          placeholder="Select rubber/spandex"
          options={toOptions(m?.rubber)}
          error={errors.warpSpandex?.id?.message}
          {...register("warpSpandex.id")}
        />
        <Input label="Weight" type="number" step="0.01" error={errors.warpSpandex?.weight?.message} {...register("warpSpandex.weight")} />
      </div>

      <div className="grid grid-cols-[1fr_110px] gap-2">
        <Select
          label="Spandex covering *"
          placeholder="Select covering"
          options={toOptions(m?.covering)}
          error={errors.spandexCovering?.id?.message}
          {...register("spandexCovering.id")}
        />
        <Input label="Weight" type="number" step="0.01" error={errors.spandexCovering?.weight?.message} {...register("spandexCovering.weight")} />
      </div>

      <div className="grid grid-cols-[1fr_110px] gap-2">
        <Select
          label="Weft yarn *"
          placeholder="Select weft"
          options={toOptions(m?.weft)}
          error={errors.weftYarn?.id?.message}
          {...register("weftYarn.id")}
        />
        <Input label="Weight" type="number" step="0.01" error={errors.weftYarn?.weight?.message} {...register("weftYarn.weight")} />
      </div>

      <div>
        <p className="text-sm font-medium text-ink-600 mb-1.5">Warp yarns *</p>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_110px_36px] gap-2 items-start">
              <Select
                placeholder="Select warp yarn"
                options={toOptions(m?.warp)}
                error={errors.warpYarn?.[i]?.id?.message}
                {...register(`warpYarn.${i}.id`)}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Weight"
                error={errors.warpYarn?.[i]?.weight?.message}
                {...register(`warpYarn.${i}.weight`)}
              />
              <button
                type="button"
                onClick={() => fields.length > 1 && remove(i)}
                className="h-10 grid place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40"
                disabled={fields.length <= 1}
                aria-label="Remove warp yarn"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => append({ id: "", weight: 0 })}>
          <Plus className="h-4 w-4" /> Add warp yarn
        </Button>
      </div>

      <p className="text-sm font-semibold text-ink-600 pt-1">Construction</p>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Spandex ends" type="number" {...register("spandexEnds")} />
        <Input label="Yarn ends" type="number" {...register("yarnEnds")} />
        <Input label="Pick" type="number" {...register("pick")} />
        <Input label="Hooks" type="number" {...register("noOfHook")} />
        <Input label="Weight (g/m)" type="number" step="0.01" {...register("weight")} />
        <Input label="Conversion cost (₹)" type="number" step="0.01" {...register("conversionCost")} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>
          {initial ? "Save changes" : "Create elastic"}
        </Button>
      </div>
    </form>
  );
}
