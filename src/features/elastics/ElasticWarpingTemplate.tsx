import { useState } from "react";
import { TableScroll } from "@/components/ui/TableScroll";
import { useForm } from "react-hook-form";
import { Layers, Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useElasticMutations, useMaterialsByCategory } from "./hooks";
import { Elastic, TemplateSection } from "./types";
import {
  WarpingTemplateEditor,
  WithTemplate,
  emptyBeam,
  formToTemplate,
  templateToForm,
} from "./WarpingTemplateEditor";

/**
 * The elastic's warping template, on its own card.
 *
 * Edit when there is one, create when there is not — the same panel
 * either way, because "no template yet" is a state of this product, not
 * a different screen.
 */

const yarnName = (s: TemplateSection): string => {
  const y = s.warpYarn;
  if (!y) return "—";
  return typeof y === "object" ? (y.name ?? "—") : String(y);
};

export function ElasticWarpingTemplate({ elastic }: { elastic: Elastic }) {
  const { toast } = useToast();
  const { saveTemplate } = useElasticMutations();
  const materials = useMaterialsByCategory();
  const [open, setOpen] = useState(false);

  const beams = elastic.warpingPlanTemplate?.beams ?? [];
  const has = beams.length > 0;

  const { control, register, handleSubmit, reset } = useForm<WithTemplate>({
    defaultValues: { warpingPlanTemplate: { beams: templateToForm(elastic.warpingPlanTemplate) } },
  });

  const openEditor = () => {
    // Reseed from the elastic each time, so reopening after a save (or a
    // cancel) never edits a stale copy.
    const existing = templateToForm(elastic.warpingPlanTemplate);
    reset({ warpingPlanTemplate: { beams: existing.length ? existing : [emptyBeam(1)] } });
    setOpen(true);
  };

  return (
    <>
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">Warping plan template</h3>
            <p className="text-xs text-ink-400">
              How this elastic is warped. A job carrying it starts its warping plan from
              a copy of this, so later edits here never change a programme already running.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={openEditor}>
            {has ? (
              <>
                <Pencil className="h-4 w-4" /> Edit template
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Create template
              </>
            )}
          </Button>
        </div>

        {!has ? (
          <div className="mt-4 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center">
            <Layers className="mx-auto h-5 w-5 text-ink-400" />
            <p className="mt-2 text-sm text-ink-400">
              No template yet — every job carrying this elastic has to be planned by hand.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {beams.map((b, i) => (
              <div key={i} className="rounded-lg border border-ink-100">
                <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
                  <span className="text-sm font-medium">Beam {b.beamNo ?? i + 1}</span>
                  <span className="ml-auto text-xs text-ink-400">
                    {b.totalEnds ?? (b.sections ?? []).reduce((s, x) => s + (x.ends ?? 0), 0)} ends
                  </span>
                </div>
                <TableScroll>
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-ink-400">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Warp yarn</th>
                        <th className="px-3 py-1.5 text-right font-medium">Ends</th>
                        <th className="px-3 py-1.5 text-right font-medium">Max m</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {(b.sections ?? []).map((s, j) => (
                        <tr key={j}>
                          <td className="px-3 py-1.5">{yarnName(s)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{s.ends ?? 0}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-ink-400">
                            {s.maxMeters ? s.maxMeters.toLocaleString("en-IN") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              </div>
            ))}
          </div>
        )}
      </Card>

      <FormScreen
        open={open}
        onClose={() => setOpen(false)}
        title={`${has ? "Edit" : "Create"} warping template — ${elastic.name}`}
        width="max-w-2xl"
      >
        <form
          noValidate
          onSubmit={handleSubmit((v) =>
            saveTemplate.mutate(
              { id: elastic._id, template: formToTemplate(v.warpingPlanTemplate?.beams) },
              {
                onSuccess: () => {
                  setOpen(false);
                  // Clearing every beam is a real intent, not a failed
                  // save, so it gets its own wording.
                  toast(
                    formToTemplate(v.warpingPlanTemplate?.beams)
                      ? "Warping template saved"
                      : "Warping template removed",
                    "success"
                  );
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Could not save the template", "error"),
              }
            )
          )}
          className="space-y-4"
        >
          <WarpingTemplateEditor
            control={control}
            register={register}
            warpMaterials={materials.data?.warp}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saveTemplate.isPending}>
              Save template
            </Button>
          </div>
        </form>
      </FormScreen>
    </>
  );
}
