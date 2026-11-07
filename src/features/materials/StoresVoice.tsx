import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  "Issue 20 kg 40s black to job 512" — said into the phone (the browser
//  writes it down, in English or Tamil) or typed, read into a movement,
//  checked, and saved through the same stock adjustment as the screen.
// ══════════════════════════════════════════════════════════════════

type Action = "issue" | "receive" | "return";
interface Mat { _id: string; name: string; unit: string; stock: number }
export interface StoresDraft {
  draft: { action: Action | null; quantity: number | null; unit: string | null; material: Mat | null; candidates: Mat[]; job: { _id: string; jobOrderNo: number; status?: string } | null; jobNo: number | null; lot: { _id: string; lotNo: string; balance: number } | null; lotNo: string | null; heard: string };
  problems: string[];
  by: "rules" | "model";
  aiSuggestion: string | null;
}

interface SpeechLike { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void }
const Speech = (): (new () => SpeechLike) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechLike; webkitSpeechRecognition?: new () => SpeechLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export function StoresVoiceDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState(false);
  const [res, setRes] = useState<StoresDraft | null>(null);
  const [action, setAction] = useState<Action>("issue");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [spoken, setSpoken] = useState(false);
  const rec = useRef<SpeechLike | null>(null);
  const canSpeak = !!Speech();

  useEffect(() => () => rec.current?.stop(), []);

  const read = async (line: string) => {
    if (!line.trim()) return;
    setReading(true);
    try {
      const r = await httpClient.post<StoresDraft>("/materials/command", { text: line });
      setRes(r);
      setAction(r.draft.action ?? "issue");
      setMaterialId(r.draft.material?._id ?? "");
      setQty(r.draft.quantity != null ? String(r.draft.quantity) : "");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not read it", "error"); } finally { setReading(false); }
  };

  const listen = () => {
    const S = Speech();
    if (!S) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new S();
    r.lang = lang; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const said = Array.from(e.results).map((x) => x[0].transcript).join(" "); setText(said); setSpoken(true); read(said); };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); toast("Did not catch that — try again, or type it", "info"); };
    rec.current = r; setListening(true); r.start();
  };

  const options = res ? [...(res.draft.material ? [res.draft.material] : []), ...res.draft.candidates.filter((c) => c._id !== res.draft.material?._id)] : [];
  const mat = options.find((m) => m._id === materialId) ?? null;
  const n = Number(qty);
  const save = async () => {
    if (!res || !mat || !(n > 0)) return;
    setSaving(true);
    try {
      const out = await httpClient.post<{ updated: { name: string; newStock: number }[]; errors?: { error: string }[] }>("/materials/bulk-adjust-stock", {
        adjustments: [{
          _id: mat._id, adjustment: action === "issue" ? -n : n, action,
          reason: `${spoken ? "Spoken" : "Typed"}: ${res.draft.heard}`.slice(0, 200),
          ...(action === "issue" && res.draft.job ? { job: res.draft.job._id } : {}),
          ...(action === "issue" && res.draft.lot ? { yarnLot: res.draft.lot._id } : {}),
          ...(action !== "issue" && res.draft.lotNo ? { lotNo: res.draft.lotNo } : {}),
        }],
        aiSuggestion: res.aiSuggestion,
      });
      if (out.errors?.length) throw new Error(out.errors[0].error);
      qc.invalidateQueries({ queryKey: ["materials"] });
      toast(`${action === "issue" ? "Issued" : action === "return" ? "Returned" : "Received"} — ${mat.name} now ${out.updated[0]?.newStock ?? ""} ${mat.unit}`, "success");
      setRes(null); setText("");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save", "error"); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Say what moved" width="max-w-lg">
      <div className="space-y-3">
        <p className="text-sm text-ink-500">“Issue 20 kg 40s black to job 512”, “Received 6 bags spandex lot SP77”, “Job 512 returned 3 kg 40s black”.</p>
        <div className="flex flex-wrap items-end gap-2">
          {canSpeak && (
            <>
              <Button type="button" variant={listening ? "danger" : "secondary"} onClick={listen}>{listening ? <><MicOff className="h-4 w-4" /> Stop</> : <><Mic className="h-4 w-4" /> Speak</>}</Button>
              <Select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)} options={[{ value: "en-IN", label: "English" }, { value: "ta-IN", label: "தமிழ்" }, { value: "hi-IN", label: "हिन्दी" }]} />
            </>
          )}
          <form className="flex min-w-[14rem] flex-1 items-end gap-2" onSubmit={(e) => { e.preventDefault(); read(text); }}>
            <Input label={canSpeak ? "Or type it" : "Type it"} className="flex-1" value={text} onChange={(e) => { setText(e.target.value); setSpoken(false); }} placeholder="issue 20 kg 40s black to job 512" />
            <Button type="submit" variant="secondary" loading={reading} disabled={!text.trim()}>Read</Button>
          </form>
        </div>
        {res && (
          <div className="space-y-3 rounded-lg border border-ink-100 p-3">
            {res.problems.length > 0 && <ul role="alert" className="space-y-1 rounded-lg bg-status-warningBg p-2 text-sm text-status-warning">{res.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <div className="grid gap-3 sm:grid-cols-3">
              <Select label="What" value={action} onChange={(e) => setAction(e.target.value as Action)} options={[{ value: "issue", label: "Issue out" }, { value: "receive", label: "Receive in" }, { value: "return", label: "Return to stores" }]} />
              <Select label="Material" value={materialId} onChange={(e) => setMaterialId(e.target.value)} placeholder="Pick the material" options={options.map((m) => ({ value: m._id, label: `${m.name} (${m.stock} ${m.unit})` }))} />
              <Input label={`Quantity${mat ? ` (${mat.unit})` : ""}`} type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <p className="text-sm text-ink-600">
              {res.draft.job && action === "issue" ? `To job J-${res.draft.job.jobOrderNo}. ` : ""}
              {res.draft.lot ? `Lot ${res.draft.lot.lotNo} (${res.draft.lot.balance} left). ` : res.draft.lotNo && action !== "issue" ? `Lot ${res.draft.lotNo}. ` : ""}
              {mat && n > 0 ? `Stock after: ${Math.max(0, mat.stock + (action === "issue" ? -n : n))} ${mat.unit}.` : ""}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRes(null)}>Clear</Button>
              <Button loading={saving} disabled={!mat || !(n > 0) || (action === "issue" && !!mat && n > mat.stock)} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
