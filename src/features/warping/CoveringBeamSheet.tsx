import { useMemo, useState } from "react";
import { AlertTriangle, Printer, ScanText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import { useCoveringMutations } from "./hooks";
import { coveringService } from "./api";
import { BeamEntriesSaved, BeamSheetRow, Covering } from "./types";

const MAX_FILES = 4;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const BEAM_WEIGHT_MAX_KG = 2000;
const LOW_CONFIDENCE = 0.6;

const PROBLEMS: Record<string, string> = {
  not_a_covering_sheet: "This does not look like a covering programme.",
  unreadable: "Nothing could be read off this photo.",
  blurry: "The photo is blurry — some figures may be wrong.",
  cut_off: "Part of the sheet is cut off — some rows may be missing.",
};

function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

interface EditRow {
  key: number;
  sNo: number | null;
  beamNo: string;
  weight: string;
  note: string;
  include: boolean;
  confidence: number;
}

type RowState =
  | { kind: "new" }
  | { kind: "invalid"; why: string }
  | { kind: "recorded_same" }
  | { kind: "recorded_different"; recordedWeight: number }
  | { kind: "duplicate" };

const toEdit = (r: BeamSheetRow, key: number): EditRow => ({
  key,
  sNo: r.sNo,
  beamNo: r.beamNo != null ? String(r.beamNo) : "",
  weight: r.weight != null ? String(r.weight) : "",
  note: r.remarks ?? "",
  // Only a new, readable beam starts ticked: one already recorded, or
  // a row that needs fixing, waits for a person to decide.
  include: r.status === "new",
  confidence: r.confidence,
});

/**
 * Where each row stands as it is now (after any fixing), against the
 * beams already recorded and the rows above it that are ticked.
 */
function rowStates(rows: EditRow[], recorded: Map<number, number>): RowState[] {
  const taken = new Set<number>();
  return rows.map((r) => {
    const no = Number(r.beamNo);
    const w = Number(r.weight);
    if (!r.beamNo.trim() || !Number.isInteger(no) || no <= 0) return { kind: "invalid", why: "Beam number?" };
    if (!r.weight.trim() || !Number.isFinite(w) || w <= 0) return { kind: "invalid", why: "Weight?" };
    if (w > BEAM_WEIGHT_MAX_KG) return { kind: "invalid", why: `Over ${BEAM_WEIGHT_MAX_KG} kg` };
    const had = recorded.get(no);
    if (had != null) {
      return Math.abs(had - w) < 0.0005 ? { kind: "recorded_same" } : { kind: "recorded_different", recordedWeight: had };
    }
    if (!r.include) return { kind: "new" };
    if (taken.has(no)) return { kind: "duplicate" };
    taken.add(no);
    return { kind: "new" };
  });
}

function StateLabel({ state }: { state: RowState }) {
  switch (state.kind) {
    case "new":
      return <span className="text-status-success">New</span>;
    case "recorded_same":
      return <span className="text-ink-400">Already recorded</span>;
    case "recorded_different":
      return <span className="text-status-danger">Recorded at {fmtKg(state.recordedWeight)} kg</span>;
    case "duplicate":
      return <span className="text-status-danger">On another row too</span>;
    default:
      return <span className="text-status-warning">{state.why}</span>;
  }
}

/**
 * The filled covering programme, back from the machine: photograph it,
 * check the beams read off it, save them together, then print their
 * labels. Nothing is saved until Save.
 */
export function CoveringBeamSheet({ open, onClose, covering }: { open: boolean; onClose: () => void; covering: Covering }) {
  const { toast } = useToast();
  const { readSheet, saveBeams } = useCoveringMutations();
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<EditRow[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [saved, setSaved] = useState<BeamEntriesSaved | null>(null);

  const recorded = useMemo(
    () => new Map((covering.beamEntries ?? []).map((b) => [Number(b.beamNo), Number(b.weight)])),
    [covering.beamEntries]
  );
  const states = useMemo(() => (rows ? rowStates(rows, recorded) : []), [rows, recorded]);
  const toSave = rows ? rows.filter((r, i) => r.include && states[i].kind === "new") : [];
  const blocked = rows ? rows.some((r, i) => r.include && states[i].kind === "duplicate") : false;
  const tooMany = files.length > MAX_FILES;

  const read = () => {
    if (!files.length || tooMany) return;
    readSheet.mutate(
      { id: covering._id, files },
      {
        onSuccess: (res) => {
          if (!res.available) {
            setUnavailable(res.message ?? "Reading photos is not set up. Enter the beams by hand.");
            return;
          }
          setRows(res.reading.rows.map(toEdit));
          setWarnings(res.warnings);
          setProblem(res.reading.problem);
          setSuggestionId(res.suggestionId);
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not read the sheet", "error"),
      }
    );
  };

  const edit = (key: number, patch: Partial<EditRow>) =>
    setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = () => {
    if (!toSave.length || blocked) return;
    saveBeams.mutate(
      {
        id: covering._id,
        suggestionId,
        beams: toSave.map((r) => ({ beamNo: Number(r.beamNo), weight: Number(r.weight), note: r.note.trim() || undefined })),
      },
      {
        onSuccess: (res) => {
          setSaved(res);
          toast(`${res.added.length} beam${res.added.length === 1 ? "" : "s"} saved`, "success");
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save the beams", "error"),
      }
    );
  };

  const addedNos = saved?.added.map((b) => b.beamNo) ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Read the beam sheet" width="max-w-2xl">
      {saved ? (
        <div className="space-y-4">
          <p className="text-sm">
            {saved.added.length
              ? `Saved beam${saved.added.length === 1 ? "" : "s"} ${addedNos.join(", ")} — ${fmtKg(
                  saved.added.reduce((t, b) => t + b.weight, 0)
                )} kg. The covering now has ${saved.totalBeams} beam${saved.totalBeams === 1 ? "" : "s"}, ${fmtKg(saved.producedWeight)} kg.`
              : "Every beam was already recorded; nothing new was saved."}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {saved.added.length > 0 && (
              <a href={coveringService.beamLabelsPdfUrl(covering._id, addedNos)} target="_blank" rel="noreferrer">
                <Button type="button" variant="secondary">
                  <Printer className="h-4 w-4" /> Print labels for these beams
                </Button>
              </a>
            )}
            <Button type="button" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : !rows ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="beam-sheet-photos" className="mb-1.5 block text-sm font-medium text-ink-600">
              Photo of the filled covering programme *
            </label>
            <input
              id="beam-sheet-photos"
              type="file"
              accept={ACCEPT}
              multiple
              onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setUnavailable(null); }}
              className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            <p className={tooMany ? "mt-1 text-xs text-status-danger" : "mt-1 text-xs text-ink-400"}>
              {tooMany
                ? `At most ${MAX_FILES} photos at a time.`
                : "The printed programme with the beam numbers and weights written in. JPEG, PNG or PDF; flat and in good light."}
            </p>
          </div>
          {unavailable && (
            <p role="alert" className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">{unavailable}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={readSheet.isPending}>Cancel</Button>
            <Button type="button" loading={readSheet.isPending} disabled={!files.length || tooMany} onClick={read}>
              <ScanText className="h-4 w-4" /> Read sheet
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(warnings.length > 0 || (problem && PROBLEMS[problem])) && (
            <div role="alert" className="space-y-1 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
              {[...(problem && PROBLEMS[problem] ? [PROBLEMS[problem]] : []), ...warnings].map((w) => (
                <p key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {w}</p>
              ))}
            </div>
          )}
          {rows.length === 0 ? (
            <p className="text-sm text-ink-400">No beams were read off the sheet.</p>
          ) : (
            <>
              <p className="text-xs text-ink-400">
                Check each row against the sheet. Fix a figure by typing over it; untick a row to leave it out.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-400">
                      <th className="py-1 pr-2 font-medium"><span className="sr-only">Save</span></th>
                      <th className="py-1 pr-2 font-medium">S.No</th>
                      <th className="py-1 pr-2 font-medium">Beam #</th>
                      <th className="py-1 pr-2 font-medium">Weight (kg)</th>
                      <th className="py-1 pr-2 font-medium">Remarks</th>
                      <th className="py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {rows.map((r, i) => {
                      const st = states[i];
                      const locked = st.kind === "recorded_same" || st.kind === "recorded_different" || st.kind === "invalid";
                      const unsure = r.confidence < LOW_CONFIDENCE;
                      const label = `row ${r.sNo ?? i + 1}`;
                      return (
                        <tr key={r.key} className={cn(unsure && "bg-status-warningBg/40")}>
                          <td className="py-1 pr-2">
                            <input
                              type="checkbox"
                              aria-label={`Save ${label}`}
                              checked={r.include && !locked}
                              disabled={locked}
                              onChange={(e) => edit(r.key, { include: e.target.checked })}
                            />
                          </td>
                          <td className="py-1 pr-2 tabular-nums text-ink-400">{r.sNo ?? "—"}</td>
                          <td className="py-1 pr-2">
                            <input
                              aria-label={`Beam # on ${label}`}
                              inputMode="numeric"
                              value={r.beamNo}
                              onChange={(e) => edit(r.key, { beamNo: e.target.value, include: true })}
                              className="w-16 rounded border border-ink-200 px-2 py-1 tabular-nums"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              aria-label={`Weight on ${label}`}
                              inputMode="decimal"
                              value={r.weight}
                              onChange={(e) => edit(r.key, { weight: e.target.value, include: true })}
                              className="w-24 rounded border border-ink-200 px-2 py-1 text-right tabular-nums"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              aria-label={`Remarks on ${label}`}
                              value={r.note}
                              onChange={(e) => edit(r.key, { note: e.target.value })}
                              className="w-full min-w-[6rem] rounded border border-ink-200 px-2 py-1"
                            />
                          </td>
                          <td className="py-1 text-xs whitespace-nowrap">
                            <StateLabel state={st} />
                            {unsure && st.kind === "new" && <span className="text-status-warning"> · check</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.some((_, i) => states[i].kind === "recorded_different") && (
                <p className="text-xs text-ink-400">
                  A beam recorded at a different weight is left as it is. Remove that entry under Beam entries first if it was wrong.
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setRows(null); setFiles([]); }} disabled={saveBeams.isPending}>
              Read another photo
            </Button>
            <Button type="button" loading={saveBeams.isPending} disabled={!toSave.length || blocked} onClick={save}>
              Save {toSave.length} beam{toSave.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
