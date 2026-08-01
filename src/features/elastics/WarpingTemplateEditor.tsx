import { Control, Controller, FieldErrors, UseFormRegister, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { MaterialRef } from "./types";

/**
 * The warping plan template carried by an elastic.
 *
 * An elastic is warped the same way every time it runs — the same beams,
 * the same sections, the same ends. Re-entering that on every job is how
 * two runs of one product end up built differently. Recorded once here,
 * it becomes the starting point for the warping plan of any job carrying
 * this elastic.
 *
 * It is a template, not a rule: the plan takes its own copy, so editing
 * this later never rewrites a programme already on the floor.
 */

export interface TemplateSectionValues {
  warpYarn: string;
  ends: number;
  maxMeters: number;
}
export interface TemplateBeamValues {
  beamNo: number;
  sections: TemplateSectionValues[];
}
export interface WithTemplate {
  warpingPlanTemplate: { beams: TemplateBeamValues[] };
}

export const emptySection = (): TemplateSectionValues => ({ warpYarn: "", ends: 0, maxMeters: 0 });
export const emptyBeam = (beamNo: number): TemplateBeamValues => ({
  beamNo,
  sections: [emptySection()],
});

/** Beams as the API returns them, mapped to what the form edits. */
export function templateToForm(
  tpl?: { beams?: Array<{ beamNo?: number; sections?: Array<{ warpYarn?: unknown; ends?: number; maxMeters?: number }> }> } | null
): TemplateBeamValues[] {
  const beams = tpl?.beams ?? [];
  return beams.map((b, i) => ({
    beamNo: b.beamNo ?? i + 1,
    sections: (b.sections ?? []).map((s) => ({
      // The section's yarn arrives populated on a detail read and as a
      // bare id after a save; both have to edit the same.
      warpYarn:
        s.warpYarn && typeof s.warpYarn === "object"
          ? String((s.warpYarn as { _id?: string })._id ?? "")
          : String(s.warpYarn ?? ""),
      ends: Number(s.ends ?? 0),
      maxMeters: Number(s.maxMeters ?? 0),
    })),
  }));
}

/**
 * Strip the empty rows a half-filled form leaves behind and hand back
 * undefined when nothing was entered — the API treats an absent
 * template as "no template", and an array of blanks is not one.
 */
export function formToTemplate(beams: TemplateBeamValues[] | undefined) {
  const cleaned = (beams ?? [])
    .map((b, i) => ({
      beamNo: Number(b.beamNo) || i + 1,
      sections: (b.sections ?? [])
        .filter((s) => s.warpYarn && Number(s.ends) > 0)
        // A number <input> hands back a string. Coercing here keeps the
        // payload matching the type that describes it, rather than
        // relying on the server to parse what we called a number.
        .map((s) => ({
          warpYarn: s.warpYarn,
          ends: Number(s.ends) || 0,
          maxMeters: Number(s.maxMeters) || 0,
        })),
    }))
    .filter((b) => b.sections.length > 0);
  return cleaned.length ? { beams: cleaned } : undefined;
}

function BeamSections({
  control,
  register,
  beamIndex,
  warpOptions,
}: {
  control: Control<WithTemplate>;
  register: UseFormRegister<WithTemplate>;
  beamIndex: number;
  warpOptions: Array<{ value: string; label: string }>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `warpingPlanTemplate.beams.${beamIndex}.sections`,
  });
  const sections = useWatch({ control, name: `warpingPlanTemplate.beams.${beamIndex}.sections` });
  const totalEnds = (sections ?? []).reduce((sum, s) => sum + (Number(s?.ends) || 0), 0);

  return (
    <>
      <div className="space-y-2">
        {fields.map((f, s) => (
          <div key={f.id} className="grid grid-cols-[1fr_90px_110px_36px] items-start gap-2">
            <Controller
              control={control}
              name={`warpingPlanTemplate.beams.${beamIndex}.sections.${s}.warpYarn`}
              render={({ field }) => (
                <Combobox
                  aria-label={`Warp yarn for beam ${beamIndex + 1} section ${s + 1}`}
                  placeholder="Select warp yarn"
                  options={warpOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Input
              aria-label={`Ends for beam ${beamIndex + 1} section ${s + 1}`}
              type="number"
              placeholder="Ends"
              {...register(`warpingPlanTemplate.beams.${beamIndex}.sections.${s}.ends`)}
            />
            <Input
              aria-label={`Max meters for beam ${beamIndex + 1} section ${s + 1}`}
              type="number"
              placeholder="Max m"
              {...register(`warpingPlanTemplate.beams.${beamIndex}.sections.${s}.maxMeters`)}
            />
            <button
              type="button"
              onClick={() => fields.length > 1 && remove(s)}
              disabled={fields.length <= 1}
              aria-label={`Remove section ${s + 1} of beam ${beamIndex + 1}`}
              className="h-10 grid place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => append(emptySection())}>
          <Plus className="h-4 w-4" /> Add section
        </Button>
        {/* The figure the machine is set to — worth seeing while typing
            rather than after saving. */}
        <span className="text-xs text-ink-400">
          Total ends: <span className="font-semibold tabular-nums text-ink-600">{totalEnds}</span>
        </span>
      </div>
    </>
  );
}

export function WarpingTemplateEditor({
  control,
  register,
  warpMaterials,
}: {
  control: Control<WithTemplate>;
  register: UseFormRegister<WithTemplate>;
  errors?: FieldErrors<WithTemplate>;
  warpMaterials?: MaterialRef[];
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "warpingPlanTemplate.beams" });
  const warpOptions = (warpMaterials ?? []).map((m) => ({ value: m._id, label: m.name }));

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-600">Warping plan template</p>
          <p className="text-xs text-ink-400">
            How this elastic is warped. A job carrying it starts its warping plan from
            here instead of being built from scratch — and can still be changed before
            it runs.
          </p>
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center">
          <Layers className="mx-auto h-5 w-5 text-ink-400" />
          <p className="mt-2 text-sm text-ink-400">
            No template yet. Optional — add one to skip planning this elastic by hand.
          </p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => append(emptyBeam(1))}>
            <Plus className="h-4 w-4" /> Add beam
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-3">
            {fields.map((f, i) => (
              <div
                key={f.id}
                role="group"
                aria-label={`Beam ${i + 1}`}
                className="rounded-lg border border-ink-100 p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-medium">Beam {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`Remove beam ${i + 1}`}
                    className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <BeamSections
                  control={control}
                  register={register}
                  beamIndex={i}
                  warpOptions={warpOptions}
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => append(emptyBeam(fields.length + 1))}
          >
            <Plus className="h-4 w-4" /> Add beam
          </Button>
        </>
      )}
    </div>
  );
}
