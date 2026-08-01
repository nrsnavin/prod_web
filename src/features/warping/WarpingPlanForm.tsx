import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Layers, Merge, Plus, Trash2, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { usePlanContext, useWarpingMutations } from "./hooks";
import { combineBeams, separateBeam, totalEnds } from "./beamCombine";
import { TemplateBeam, YarnLotStock } from "./types";

const emptySection = () => ({ warpYarn: "", ends: 0, maxMeters: 0, yarnLot: "" });
const emptyBeams = () => [{ sections: [emptySection()] }];

/**
 * The elastics' templates, as beams this form can edit, repeated once
 * per tape.
 *
 * The template describes how ONE tape is built. A plan usually runs that
 * same build several times over, so the beams repeat and each copy is
 * stamped with the tape it belongs to — a flat list of beams gives the
 * operator no way to see where one tape ends and the next begins.
 *
 * Beam numbers run straight through the whole plan rather than restarting
 * per tape, because the beam number is how the floor identifies a beam
 * and two beam 1s would be two things with one name.
 *
 * The lot is deliberately left blank: a template says how the elastic is
 * built, not which dye lot this run comes off, and that is decided here
 * against what is actually in stock.
 */
function templateToBeams(beams: TemplateBeam[], tapes = 1) {
  const count = Math.max(1, Math.floor(tapes) || 1);
  const out = [];
  for (let tape = 1; tape <= count; tape++) {
    for (const b of beams) {
      out.push({
        beamNo: out.length + 1,
        tapeNo: tape,
        elastic: b.elasticId,
        // A repeat is an independent copy; carrying a pairing across
        // would point at a beam in another tape.
        pairedBeamNo: null,
        sections: b.sections.map((s) => ({
          warpYarn: s.warpYarnId,
          ends: s.ends,
          maxMeters: s.maxMeters,
          yarnLot: "",
        })),
      });
    }
  }
  return out;
}

/**
 * Lot-wise stock for the yarns this plan can call on.
 *
 * Programming a beam is where the lot decision is really made — a beam
 * wants to come off one lot, because two lots meeting inside it show as
 * a shade band. So the largest single lot is shown alongside the total:
 * 300 kg spread over six lots of 50 will not carry a section that 300 kg
 * on one lot would, and the aggregate figure hides exactly that.
 */
function LotStockPanel({ stock }: { stock: YarnLotStock[] }) {
  if (stock.length === 0) return null;
  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <p className="text-sm font-medium">Lot-wise stock</p>
      <p className="text-xs text-ink-400">
        A beam should come off one lot — mixing lots shows as a shade band.
      </p>
      <div className="mt-2 space-y-2">
        {stock.map((s) => (
          <div key={s.warpYarnId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm">{s.warpYarnName}</span>
              <span className="text-xs text-ink-600">
                <span className="tabular-nums font-semibold">
                  {s.totalAvailable.toLocaleString("en-IN")}
                </span>{" "}
                kg over {s.lots.length} lot{s.lots.length === 1 ? "" : "s"}
                {s.lots.length > 1 && (
                  <>
                    {" · largest "}
                    <span className="tabular-nums font-semibold">
                      {s.largestLot.toLocaleString("en-IN")}
                    </span>{" "}
                    kg
                  </>
                )}
              </span>
            </div>
            {s.lots.length === 0 ? (
              <p className="text-xs text-status-warning">
                No open lots — receive stock against a lot number before warping.
              </p>
            ) : (
              <p className="text-xs text-ink-400">
                {s.lots
                  .map(
                    (l) =>
                      `${l.lotNo}${l.shade ? ` (${l.shade})` : ""} — ${l.balance.toLocaleString("en-IN")}`
                  )
                  .join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const sectionSchema = z.object({
  warpYarn: z.string().min(1, "Yarn required"),
  ends: z.coerce.number().positive("Ends > 0"),
  maxMeters: z.coerce.number().min(0).optional(),
  // Which dye lot this section runs off. Optional: an undyed or
  // untracked yarn has none, and the section is still valid without one.
  yarnLot: z.string().optional(),
});
const schema = z.object({
  remarks: z.string().optional(),
  beams: z
    .array(
      z.object({
        beamNo: z.coerce.number().optional(),
        // Which elastic this beam warps, when the plan was filled from a
        // template. Carried so a hand-saved plan keeps the attribution
        // an auto-created one has; the server drops anything that is not
        // one of the job's own elastics.
        elastic: z.string().nullable().optional(),
        /** Which tape this beam belongs to, when the plan repeats one. */
        tapeNo: z.coerce.number().nullable().optional(),
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
  const context = usePlanContext(jobId);
  const yarns = { data: context.data?.warpYarns };
  const { createPlan } = useWarpingMutations();

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<PlanValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      remarks: "",
      beams: emptyBeams(),
    },
  });
  const beams = useFieldArray({ control, name: "beams" });

  // ── Fill from the elastics' templates ───────────────────────────────
  // The context arrives after the form mounts, so the beams are replaced
  // once it does. Guarded by a ref rather than by comparing values: it
  // must fill exactly once, and never overwrite what someone has already
  // typed while the request was in flight.
  const templateBeams = context.data?.templateBeams ?? [];
  const hasTemplate = templateBeams.length > 0;
  const [filledFromTemplate, setFilledFromTemplate] = useState(false);
  const prefilled = useRef(false);

  // How many times the template's build is repeated. Changing it rebuilds
  // the beams, which is only safe while they still ARE the template —
  // once someone edits a beam, `filledFromTemplate` is what protects it.
  //
  // Held as text, not a number: clamping on every keystroke means an
  // emptied field snaps back to 1, and the next digit typed lands
  // AFTER it — clearing to type 3 would give 13.
  const [tapesText, setTapesText] = useState("1");
  const tapes = Math.max(1, Math.min(99, Math.floor(Number(tapesText)) || 1));

  const applyTemplate = (count = tapes) => {
    beams.replace(templateToBeams(templateBeams, count));
    setFilledFromTemplate(true);
    prefilled.current = true;
  };

  const changeTapes = (text: string) => {
    setTapesText(text);
    const n = Math.max(1, Math.min(99, Math.floor(Number(text)) || 1));
    if (filledFromTemplate) applyTemplate(n);
  };

  /**
   * Copy a beam and put the copy straight after it.
   *
   * Beams are renumbered from position afterwards so the plan stays
   * self-describing; the copy starts unpaired, since a pairing names a
   * specific other beam and duplicating it would give that beam two
   * partners.
   */
  const duplicateBeam = (index: number) => {
    const current = getValues("beams");
    const source = current[index];
    const copy = {
      ...source,
      pairedBeamNo: null,
      sections: source.sections.map((sec) => ({ ...sec })),
    };
    const next = [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    beams.replace(next.map((b, i) => ({ ...b, beamNo: i + 1 })));
    toast(`Beam ${index + 1} duplicated`, "success");
  };

  useEffect(() => {
    if (prefilled.current || !hasTemplate) return;
    if (isDirty) { prefilled.current = true; return; }
    applyTemplate(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTemplate]);

  const clearBeams = () => {
    beams.replace(emptyBeams());
    setFilledFromTemplate(false);
  };

  // ── One length for every section ────────────────────────────────────
  // Most plans run every section to the same length, and typing it into
  // each one is both tedious and the place a typo hides: one section
  // 500m short is not visible in a list of numbers. Turned on, a single
  // field drives them all and the per-section inputs become read-only.
  // Mirrors the mobile app, which already works this way.
  const [uniformLength, setUniformLength] = useState(false);
  const [uniformValue, setUniformValue] = useState("");

  const applyLengthToAll = (value: string) => {
    const n = Number(value) || 0;
    getValues("beams").forEach((b, bi) =>
      b.sections.forEach((_, si) =>
        setValue(`beams.${bi}.sections.${si}.maxMeters`, n, { shouldDirty: true })
      )
    );
  };

  const toggleUniformLength = (on: boolean) => {
    setUniformLength(on);
    if (!on) return;
    // Seed from the first length already entered, so turning this on
    // adopts what is there rather than wiping it.
    const seed =
      getValues("beams")
        .flatMap((b) => b.sections)
        .map((sec) => Number(sec.maxMeters) || 0)
        .find((v) => v > 0) ?? 0;
    const text = seed > 0 ? String(seed) : "";
    setUniformValue(text);
    if (seed > 0) applyLengthToAll(text);
  };

  const changeUniformLength = (text: string) => {
    setUniformValue(text);
    applyLengthToAll(text);
  };

  /** New rows must not sit outside a uniformity the plan is claiming. */
  const newSection = () => ({
    ...emptySection(),
    maxMeters: uniformLength ? Number(uniformValue) || 0 : 0,
  });

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
              elastic: b.elastic ?? null,
              tapeNo: b.tapeNo ?? null,
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

      <LotStockPanel stock={context.data?.lotStock ?? []} />

      {hasTemplate && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info">
          <Layers className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {filledFromTemplate ? (
              <>
                Filled from the warping template of{" "}
                {Array.from(new Set(templateBeams.map((b) => b.elasticName).filter(Boolean))).join(
                  ", "
                )}
                . Change anything before saving — the template is not touched.
              </>
            ) : (
              <>This job&apos;s elastics have a warping template you can start from.</>
            )}
          </span>
          {/* The template describes one tape; this is how many of them
              the plan runs. Rebuilding on change is safe only while the
              beams still are the template — after Start empty it stops. */}
          {filledFromTemplate && (
            <label className="flex items-center gap-2 text-xs font-medium">
              Tapes
              <input
                type="number"
                min={1}
                max={99}
                aria-label="Number of tapes"
                value={tapesText}
                onChange={(e) => changeTapes(e.target.value)}
                onBlur={() => setTapesText(String(tapes))}
                className="h-8 w-16 rounded-lg border border-ink-200 bg-surface px-2 text-center text-sm tabular-nums text-ink-900 focus:border-brand-500 focus:outline-none"
              />
              <span className="text-ink-400">
                × {templateBeams.length} = {tapes * templateBeams.length} beams
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={() => (filledFromTemplate ? clearBeams() : applyTemplate())}
            className="rounded px-2 py-1 text-xs font-semibold hover:bg-status-info/10"
          >
            {filledFromTemplate ? "Start empty" : "Use template"}
          </button>
        </div>
      )}

      {/* One length for every section — see toggleUniformLength. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-100 px-3 py-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={uniformLength}
            aria-label="Same length for every section"
            onChange={(e) => toggleUniformLength(e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          Same length for every section
        </label>
        {uniformLength && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="number"
              min={0}
              aria-label="Shared section length"
              value={uniformValue}
              onChange={(e) => changeUniformLength(e.target.value)}
              className="h-9 w-28 rounded-lg border border-ink-200 bg-surface px-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none"
            />
            <span className="text-xs text-ink-400">m on every section</span>
          </label>
        )}
      </div>

      {beams.fields.map((beam, bi) => (
        <BeamFields
          key={beam.id}
          index={bi}
          control={control}
          register={register}
          errors={errors}
          yarnOptions={yarnOptions}
          lotStock={context.data?.lotStock ?? []}
          elasticName={
            templateBeams.find((t) => t.elasticId && t.elasticId === watched?.[bi]?.elastic)
              ?.elasticName ?? ""
          }
          tapeNo={watched?.[bi]?.tapeNo ?? null}
          lengthLocked={uniformLength}
          newSection={newSection}
          watchedSections={watched?.[bi]?.sections}
          onDuplicate={() => duplicateBeam(bi)}
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
          onClick={() => beams.append({ sections: [newSection()] })}
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
  elasticName,
  tapeNo,
  onDuplicate,
  lengthLocked,
  newSection,
  control,
  register,
  errors,
  yarnOptions,
  lotStock,
  watchedSections,
  onRemove,
  combining,
  picked,
  onPick,
  pairedWith,
  endsTotal,
  onUnpair,
}: {
  index: number;
  /** Empty unless this beam came from a template. */
  elasticName?: string;
  /** Null for a beam added by hand, which belongs to no tape. */
  tapeNo?: number | null;
  onDuplicate: () => void;
  /** True while one shared field drives every section's length. */
  lengthLocked: boolean;
  newSection: () => { warpYarn: string; ends: number; maxMeters: number; yarnLot: string };
  control: Control<PlanValues>;
  register: UseFormRegister<PlanValues>;
  errors: FieldErrors<PlanValues>;
  yarnOptions: { value: string; label: string }[];
  lotStock: YarnLotStock[];
  /** This beam's live section values, so the lot list follows the yarn. */
  watchedSections?: PlanValues["beams"][number]["sections"];
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
        {/* Which tape this beam is part of — a flat list of beams gives
            the operator no way to see where one tape ends. */}
        {tapeNo != null && (
          <StatusChip tone="neutral">Tape {tapeNo}</StatusChip>
        )}
        {/* On a job carrying more than one product, which beam belongs
            to which is the first thing the programme has to say. */}
        {elasticName && (
          <span className="text-xs text-ink-400">{elasticName}</span>
        )}
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
        {/* Running the same beam twice is routine, and retyping every
            section to do it is where the two copies drift apart. */}
        <button
          type="button"
          onClick={onDuplicate}
          className="ml-auto rounded p-1 text-ink-400 hover:text-ink-900"
          aria-label={`Duplicate beam ${index + 1}`}
          title="Duplicate this beam into the programme"
        >
          <Copy className="h-4 w-4" />
        </button>
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
      <div className="grid grid-cols-[1fr_1fr_80px_80px_32px] gap-2 px-1 pb-1 text-xs font-medium text-ink-400"><span>Warp yarn</span><span>Dye lot</span><span>Ends</span><span>Length</span><span className="sr-only">Remove</span></div>
      <div className="space-y-2">
        {sections.fields.map((s, si) => {
          // Lots are offered only for the yarn actually chosen on this
          // row — a lot from another yarn is refused server-side, and
          // offering it here would be inviting the mistake.
          const chosenYarn = watchedSections?.[si]?.warpYarn ?? "";
          const forYarn = lotStock.find((l) => l.warpYarnId === chosenYarn);
          return (
            <div key={s.id} className="grid grid-cols-[1fr_1fr_80px_80px_32px] gap-2 items-start">
              <Select aria-label="Warp yarn"
                placeholder="Warp yarn"
                options={yarnOptions}
                error={errors.beams?.[index]?.sections?.[si]?.warpYarn?.message}
                {...register(`beams.${index}.sections.${si}.warpYarn`)}
              />
              <Select aria-label="Dye lot"
                placeholder={
                  !chosenYarn
                    ? "Pick a yarn first"
                    : (forYarn?.lots.length ?? 0) === 0
                      ? "No open lots"
                      : "Any lot"
                }
                disabled={!chosenYarn || (forYarn?.lots.length ?? 0) === 0}
                options={(forYarn?.lots ?? []).map((l) => ({
                  value: l.id,
                  label: `${l.lotNo}${l.shade ? ` · ${l.shade}` : ""} — ${l.balance.toLocaleString("en-IN")} kg`,
                }))}
                {...register(`beams.${index}.sections.${si}.yarnLot`)}
              />
              <Input aria-label="Ends"
                type="number"
                placeholder="Ends"
                error={errors.beams?.[index]?.sections?.[si]?.ends?.message}
                {...register(`beams.${index}.sections.${si}.ends`)}
              />
              <Input
                aria-label="Length"
                type="number"
                placeholder="Length"
                // Read-only rather than disabled: a disabled input is
                // dropped from the form, and the value still has to be
                // submitted with the section.
                readOnly={lengthLocked}
                className={lengthLocked ? "bg-ink-100/50 text-ink-400" : undefined}
                {...register(`beams.${index}.sections.${si}.maxMeters`)}
              />
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
          );
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => sections.append(newSection())}
      >
        <Plus className="h-4 w-4" /> Add section
      </Button>
    </div>
  );
}
