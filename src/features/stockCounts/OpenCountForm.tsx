import { useMemo, useState } from "react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { toApiError } from "@/core/http/httpClient";
import { useMaterials } from "@/features/materials/hooks";
import { useStockCountMutations } from "./hooks";
import { StockCountScopeKind } from "./types";

const KIND_OPTIONS: Array<{ value: StockCountScopeKind; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "category", label: "One category" },
  { value: "materials", label: "Pick materials" },
];

export interface OpenCountFormProps {
  open: boolean;
  onClose: () => void;
  onOpened: (id: string) => void;
}

/**
 * Opening a count is choosing what to walk. The scope is the whole
 * decision — everything after it is arithmetic — so the form shows how
 * many materials the choice covers before anything is frozen.
 */
export function OpenCountForm({ open, onClose, onOpened }: OpenCountFormProps) {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<StockCountScopeKind>("all");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const { data: materials = [] } = useMaterials({ search: "", category: "all", lowStock: false });
  const { open: openCount } = useStockCountMutations();

  const categories = useMemo(
    () => Array.from(new Set(materials.map((m) => m.category).filter(Boolean))).sort(),
    [materials]
  );

  // What this scope will actually cover, worked out from the same
  // catalogue the server will read. A count opened over an empty scope
  // is rejected, and finding that out after clicking is a waste of a
  // walk to the rack.
  const covered = useMemo(() => {
    if (kind === "all") return materials.length;
    if (kind === "category") return materials.filter((m) => m.category === category).length;
    return picked.length;
  }, [kind, category, picked, materials]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? materials.filter((m) => m.name.toLowerCase().includes(q)) : materials;
    return rows.slice(0, 200);
  }, [materials, search]);

  const reset = () => {
    setLabel("");
    setKind("all");
    setCategory("");
    setPicked([]);
    setSearch("");
  };

  const submit = async () => {
    try {
      const count = await openCount.mutateAsync({
        label: label.trim(),
        scope: {
          kind,
          category: kind === "category" ? category : undefined,
          materials: kind === "materials" ? picked : undefined,
        },
      });
      reset();
      // Toast from here, not before the navigation — a toast fired
      // immediately before a screen change goes into an overlay that is
      // torn down before it renders.
      toast(
        `Count #${count.countNo} opened — ${count.lines.length} material(s) frozen at today's figures`,
        "success"
      );
      onOpened(count._id);
    } catch (err) {
      toast(toApiError(err).message, "error");
    }
  };

  const blocked =
    covered === 0 || (kind === "category" && !category) || (kind === "materials" && picked.length === 0);

  return (
    <FormScreen open={open} onClose={onClose} title="Open a stock count" width="max-w-2xl">
      <div className="space-y-4">
        <Input
          label="What is this count?"
          placeholder="Warp yarn, Rack A — March 2026"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          hint="Shown on the sheet and the variance report."
        />

        <Select
          label="Scope"
          options={KIND_OPTIONS}
          value={kind}
          onChange={(e) => setKind(e.target.value as StockCountScopeKind)}
        />

        {kind === "category" && (
          <Select
            label="Category"
            placeholder="Choose a category"
            options={categories.map((c) => ({ value: c, label: c }))}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        )}

        {kind === "materials" && (
          <div className="space-y-2">
            <Input
              label="Materials"
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto rounded-lg border border-ink-200 divide-y divide-ink-100">
              {visible.map((m) => {
                const on = picked.includes(m._id);
                return (
                  <label
                    key={m._id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-ink-100"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setPicked((p) => (on ? p.filter((x) => x !== m._id) : [...p, m._id]))
                      }
                    />
                    <span className="flex-1">{m.name}</span>
                    <span className="text-xs text-ink-400 tabular-nums">
                      {m.stock.toLocaleString("en-IN")} on hand
                    </span>
                  </label>
                );
              })}
              {visible.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-ink-400">Nothing matches that.</p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg bg-ink-100 px-4 py-3 text-sm text-ink-600">
          <p className="font-medium text-ink-900">
            {covered === 0
              ? "This scope covers nothing"
              : `${covered} material${covered === 1 ? "" : "s"} will be frozen at today's figures`}
          </p>
          <p className="mt-1">
            Nothing is locked. Production carries on while you count, and anything received or
            issued in the meantime is applied on top of your figures rather than overwritten.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={openCount.isPending} disabled={blocked}>
            Open count
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}
