import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Merge } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { httpClient } from "@/core/http/httpClient";
import { useDebouncedValue } from "@/core/hooks/useDebouncedValue";

// ══════════════════════════════════════════════════════════════════
//  One yarn entered more than once: "did you mean" while a name is
//  typed, and the groups already on file, merged into one.
// ══════════════════════════════════════════════════════════════════

interface Similar { _id: string; name: string; category: string; stock: number; unit?: string; sameYarn: boolean }

/** Under the name field: materials that are probably this one. */
export function SimilarMaterials({ name, category, exclude }: { name: string; category?: string; exclude?: string }) {
  const q = useDebouncedValue(name.trim(), 400);
  // A plain request, not a query: the form is also rendered on its own.
  const [data, setData] = useState<{ similar: Similar[] } | null>(null);
  useEffect(() => {
    if (q.length < 3) { setData(null); return; }
    let live = true;
    Promise.resolve().then(() => httpClient.get<{ similar: Similar[] }>("/materials/similar", { name: q, category, exclude }))
      .then((r) => { if (live) setData(r); }).catch(() => { if (live) setData(null); });
    return () => { live = false; };
  }, [q, category, exclude]);
  const list = data?.similar ?? [];
  if (!list.length) return null;
  return (
    <div role="note" className="rounded-lg bg-status-warningBg p-2 text-sm text-status-warning">
      Did you mean {list.map((m, i) => (
        <span key={m._id}>{i ? ", " : ""}<Link className="font-medium underline" to={`/materials/${m._id}`} target="_blank">{m.name}</Link> ({m.stock} {m.unit || "kg"})</span>
      ))}? {list.some((m) => m.sameYarn) ? "That reads as the same yarn — a second entry splits its stock." : ""}
    </div>
  );
}

export interface DuplicateGroup {
  key: string; keep: string; name: string; stock: number; warning: string | null;
  members: { _id: string; name: string; category: string; stock: number; unit?: string; uses: number }[];
}

/** On the materials list: the groups that look like one yarn, and a merge for each. */
export function DuplicateMaterials() {
  const { data } = useQuery({ queryKey: ["materials", "duplicates"], queryFn: () => httpClient.get<{ groups: DuplicateGroup[] }>("/materials/duplicates"), staleTime: 60_000 });
  const [open, setOpen] = useState<DuplicateGroup | null>(null);
  const groups = data?.groups ?? [];
  if (!groups.length) return null;
  return (
    <Card className="space-y-2 p-4">
      <div>
        <h3 className="text-base font-semibold text-ink-800">Possible duplicates</h3>
        <p className="text-sm text-ink-500">Same count, fibre and shade under different names. Merging moves their stock, receipts, POs, recipes and lots onto one.</p>
      </div>
      <ul className="divide-y divide-ink-100">
        {groups.map((g) => (
          <li key={g.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink-800">{g.name}</p>
              <p className="text-ink-500">{g.members.map((m) => m.name).join(" · ")}</p>
              {g.warning && <p className="text-status-warning">{g.warning}</p>}
            </div>
            <Button size="sm" variant="secondary" onClick={() => setOpen(g)}><Merge className="h-4 w-4" /> Review and merge</Button>
          </li>
        ))}
      </ul>
      {open && <MergeDialog group={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

export function MergeDialog({ group, onClose }: { group: DuplicateGroup; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [keep, setKeep] = useState(group.keep);
  const [picked, setPicked] = useState<string[]>(group.members.filter((m) => m._id !== group.keep && (m.unit || "kg") === (group.members.find((x) => x._id === group.keep)?.unit || "kg")).map((m) => m._id));
  const [name, setName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const from = picked.filter((id) => id !== keep);
  const total = group.members.filter((m) => m._id === keep || from.includes(m._id)).reduce((s, m) => s + (m.stock || 0), 0);
  const save = async () => {
    setSaving(true);
    try {
      await httpClient.post("/materials/merge", { into: keep, from, name, proposedName: group.name });
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      toast(`Merged into ${name}`, "success");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not merge", "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Merge into one material" width="max-w-xl">
      <div className="space-y-3">
        <Input label="Name to keep" value={name} onChange={(e) => setName(e.target.value)} />
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-400"><th className="py-1">Keep</th><th>Merge</th><th>Material</th><th className="text-right">Stock</th><th className="text-right">Used in</th></tr></thead>
          <tbody>
            {group.members.map((m) => (
              <tr key={m._id} className="border-t border-ink-100">
                <td className="py-1.5"><input type="radio" name="keep" aria-label={`Keep ${m.name}`} checked={keep === m._id} onChange={() => setKeep(m._id)} /></td>
                <td><input type="checkbox" aria-label={`Merge ${m.name}`} disabled={keep === m._id} checked={keep !== m._id && picked.includes(m._id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m._id] : p.filter((x) => x !== m._id)))} /></td>
                <td>{m.name}</td>
                <td className="text-right tabular-nums">{m.stock} {m.unit || "kg"}</td>
                <td className="text-right tabular-nums">{m.uses}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-ink-600">After the merge: <strong>{name}</strong> with {Math.round(total * 1000) / 1000} in stock. The others are archived with a note, not deleted.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!from.length || !name.trim()} onClick={save}>Merge {from.length + 1} into one</Button>
        </div>
      </div>
    </Modal>
  );
}
