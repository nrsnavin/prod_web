import { useEffect, useMemo, useRef, useState } from "react";
import {
  Type, Tag, Image as ImageIcon, Minus, Square, Table as TableIcon,
  Save, Eye, Trash2, Copy, RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import { pdfTemplateService } from "./api";
import { useDocTypes, usePdfTemplate, useSavePdfTemplate } from "./hooks";
import { DocType, ElementType, PAGE_PT, PdfTemplate, TemplateElement } from "./types";

let _idc = 0;
const newId = () => `el-${Date.now()}-${_idc++}`;

const DEFAULTS: Record<ElementType, Partial<TemplateElement>> = {
  text: { text: "Text", w: 160, h: 18, fontSize: 11, color: "#0D1B2A", align: "left" },
  field: { field: "", w: 180, h: 18, fontSize: 11, color: "#0D1B2A", align: "left" },
  image: { w: 90, h: 42 },
  line: { w: 200, h: 0, lineWidth: 1, color: "#1D6FEB" },
  box: { w: 160, h: 60, lineWidth: 1, color: "#5A6A85", fill: "" },
  table: {
    w: 515, h: 360, fontSize: 9, headerBg: "#1D6FEB", zebra: true,
    columns: [
      { field: "sno", header: "#", width: 0.5, align: "left", format: "text" },
      { field: "description", header: "Description", width: 3, align: "left", format: "text" },
      { field: "qty", header: "Qty", width: 1, align: "right", format: "number" },
      { field: "amount", header: "Amount", width: 1, align: "right", format: "currency" },
    ],
  },
};

const PALETTE: { type: ElementType; label: string; icon: typeof Type }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "field", label: "Field", icon: Tag },
  { type: "image", label: "Logo", icon: ImageIcon },
  { type: "line", label: "Line", icon: Minus },
  { type: "box", label: "Box", icon: Square },
  { type: "table", label: "Table", icon: TableIcon },
];

export function PdfDesignerPage() {
  const { toast } = useToast();
  const { data: docTypes } = useDocTypes();
  const [docType, setDocType] = useState<string>("");

  useEffect(() => {
    if (!docType && docTypes && docTypes.length) setDocType(docTypes[0].id);
  }, [docTypes, docType]);

  const { data: loaded, isLoading } = usePdfTemplate(docType || undefined);
  const save = useSavePdfTemplate();

  const [tpl, setTpl] = useState<PdfTemplate | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Hydrate the editable draft when a template loads or doc type changes.
  useEffect(() => {
    if (loaded) {
      setTpl(structuredClone(loaded));
      setSelId(null);
    }
  }, [loaded]);

  const currentDocType: DocType | undefined = docTypes?.find((d) => d.id === docType);
  const hasTable = !!tpl?.elements.some((e) => e.type === "table");

  const [pageW, pageH] = tpl
    ? PAGE_PT[tpl.pageSize][tpl.orientation]
    : PAGE_PT.A4.portrait;
  const displayW = tpl?.orientation === "landscape" ? 640 : 460;
  const scale = displayW / pageW;

  const sel = tpl?.elements.find((e) => e.id === selId) || null;

  // ── mutations on the draft ─────────────────────────────────────────
  const patchEl = (id: string, patch: Partial<TemplateElement>) =>
    setTpl((t) => (t ? { ...t, elements: t.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : t));

  const addEl = (type: ElementType) => {
    if (type === "table" && hasTable) {
      toast("A template can have only one table", "error");
      return;
    }
    const el: TemplateElement = { id: newId(), type, x: 60, y: 60, w: 160, h: 20, ...DEFAULTS[type] } as TemplateElement;
    setTpl((t) => (t ? { ...t, elements: [...t.elements, el] } : t));
    setSelId(el.id);
  };

  const deleteEl = (id: string) => {
    setTpl((t) => (t ? { ...t, elements: t.elements.filter((e) => e.id !== id) } : t));
    setSelId(null);
  };

  const duplicateEl = (id: string) => {
    setTpl((t) => {
      if (!t) return t;
      const src = t.elements.find((e) => e.id === id);
      if (!src) return t;
      const copy = { ...structuredClone(src), id: newId(), x: src.x + 12, y: src.y + 12 };
      return { ...t, elements: [...t.elements, copy] };
    });
  };

  // ── drag / resize ──────────────────────────────────────────────────
  const dragRef = useRef<{
    mode: "move" | "resize"; id: string;
    sx: number; sy: number; ox: number; oy: number; ow: number; oh: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.sx) / scale;
      const dy = (e.clientY - d.sy) / scale;
      if (d.mode === "move") {
        patchEl(d.id, {
          x: Math.max(0, Math.min(pageW, Math.round(d.ox + dx))),
          y: Math.max(0, Math.min(pageH, Math.round(d.oy + dy))),
        });
      } else {
        patchEl(d.id, {
          w: Math.max(4, Math.round(d.ow + dx)),
          h: Math.max(0, Math.round(d.oh + dy)),
        });
      }
    };
    const onUp = () => (dragRef.current = null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, pageW, pageH]);

  const startDrag = (e: React.PointerEvent, el: TemplateElement, mode: "move" | "resize") => {
    e.stopPropagation();
    setSelId(el.id);
    dragRef.current = { mode, id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
  };

  // ── save / preview ─────────────────────────────────────────────────
  const doSave = () => {
    if (!tpl || !docType) return;
    save.mutate(
      { docType, template: tpl },
      {
        onSuccess: () => toast("Template saved", "success"),
        onError: (e) => toast(e instanceof ApiError ? e.message : "Save failed", "error"),
      }
    );
  };

  const doPreview = async () => {
    if (!tpl || !docType) return;
    setPreviewing(true);
    try {
      const blob = await pdfTemplateService.preview(docType, tpl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Preview failed", "error");
    } finally {
      setPreviewing(false);
    }
  };

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const resetToStarter = async () => {
    if (!docType) return;
    // The backend returns the starter layout when nothing is saved; to get
    // a fresh starter we just refetch by clearing then reloading is complex,
    // so re-fetch the canonical template (saved or starter) and replace draft.
    try {
      const fresh = await pdfTemplateService.get(docType);
      setTpl(structuredClone(fresh));
      setSelId(null);
      toast("Reverted to the last saved layout", "success");
    } catch {
      toast("Could not reload", "error");
    }
  };

  if (isLoading || !tpl) return <Skeleton className="h-[600px] w-full" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_260px]">
      {/* ── Left rail ──────────────────────────────────────── */}
      <div className="space-y-4">
        <Card className="p-3 space-y-3">
          <Select
            label="Document"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            options={(docTypes ?? []).map((d) => ({ value: d.id, label: d.label }))}
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={tpl.enabled}
              onChange={(e) => setTpl({ ...tpl, enabled: e.target.checked })}
            />
            Use this template for {currentDocType?.label ?? "this document"}
          </label>
          {/* Without this the design is saved but never rendered — every
              PDF keeps coming out in the built-in layout, which reads as
              "the designer doesn't work". Say so plainly. */}
          {!tpl.enabled && (
            <p className="rounded-lg bg-status-warningBg px-3 py-2 text-xs text-ink-600">
              <span className="font-medium">This design is not in use.</span> Tick the box above and
              save — until then {currentDocType?.label ?? "this document"} PDFs keep using the
              built-in layout.
            </p>
          )}
          <Select
            label="Orientation"
            value={tpl.orientation}
            onChange={(e) => setTpl({ ...tpl, orientation: e.target.value as PdfTemplate["orientation"] })}
            options={[{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]}
          />
        </Card>

        <Card className="p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Add element</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PALETTE.map((p) => (
              <button
                key={p.type}
                onClick={() => addEl(p.type)}
                disabled={p.type === "table" && hasTable}
                title={p.label}
                className="flex flex-col items-center gap-1 rounded-lg border border-ink-100 py-2 text-[11px] text-ink-600 hover:border-brand-500 hover:text-brand-600 disabled:opacity-40"
              >
                <p.icon className="h-4 w-4" />
                {p.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-2">
          <Button className="w-full" onClick={doSave} loading={save.isPending}>
            <Save className="h-4 w-4" /> Save template
          </Button>
          <Button className="w-full" variant="secondary" onClick={doPreview} loading={previewing}>
            <Eye className="h-4 w-4" /> Preview PDF
          </Button>
          <Button className="w-full" variant="ghost" onClick={resetToStarter}>
            <RotateCcw className="h-4 w-4" /> Revert
          </Button>
        </div>
      </div>

      {/* ── Canvas ─────────────────────────────────────────── */}
      <div className="overflow-auto">
        <div
          // Literal white, not `bg-surface`: this is a preview of a sheet of
          // paper, so it stays white even when the app is in dark mode.
          className="relative mx-auto bg-white shadow-md ring-1 ring-ink-200"
          style={{ width: displayW, height: pageH * scale }}
          onPointerDown={() => setSelId(null)}
        >
          {tpl.elements.map((el) => (
            <CanvasElement
              key={el.id}
              el={el}
              scale={scale}
              selected={el.id === selId}
              onStartMove={(e) => startDrag(e, el, "move")}
              onStartResize={(e) => startDrag(e, el, "resize")}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-ink-400">
          A4 {tpl.orientation} · drag to move, drag the corner to resize · fields show as {"{{ }}"}
        </p>
      </div>

      {/* ── Properties ─────────────────────────────────────── */}
      <div>
        {sel ? (
          <PropertiesPanel
            key={sel.id}
            el={sel}
            fields={currentDocType?.fields ?? []}
            onChange={(patch) => patchEl(sel.id, patch)}
            onDelete={() => deleteEl(sel.id)}
            onDuplicate={() => duplicateEl(sel.id)}
          />
        ) : (
          <Card className="p-4 text-sm text-ink-400">
            Select an element to edit it, or add one from the left.
          </Card>
        )}
      </div>

      <Modal open={!!previewUrl} onClose={() => setPreviewUrl(null)} title="PDF preview" width="max-w-3xl">
        {previewUrl && <iframe title="preview" src={previewUrl} className="h-[75vh] w-full rounded-lg border border-ink-100" />}
      </Modal>
    </div>
  );
}

// ── Canvas element ──────────────────────────────────────────────────────
function CanvasElement({
  el, scale, selected, onStartMove, onStartResize,
}: {
  el: TemplateElement; scale: number; selected: boolean;
  onStartMove: (e: React.PointerEvent) => void;
  onStartResize: (e: React.PointerEvent) => void;
}) {
  const style: React.CSSProperties = {
    left: el.x * scale, top: el.y * scale,
    width: Math.max(el.w * scale, 6), height: Math.max((el.h || (el.fontSize ?? 12)) * scale, 12),
  };
  const label =
    el.type === "field" ? `{{${el.field || "field"}}}` :
    el.type === "text" ? el.text || "Text" :
    el.type === "image" ? "◨ Logo" :
    el.type === "table" ? "▦ Table" :
    el.type === "line" ? "" : "";

  return (
    <div
      onPointerDown={onStartMove}
      className={cn(
        "absolute cursor-move select-none overflow-hidden",
        selected ? "ring-2 ring-brand-500 z-10" : "ring-1 ring-transparent hover:ring-ink-200"
      )}
      style={style}
    >
      {el.type === "line" ? (
        <div style={{ borderTop: `${Math.max(1, (el.lineWidth ?? 1))}px solid ${el.color || "#1D6FEB"}`, marginTop: 4 }} />
      ) : el.type === "box" ? (
        <div className="h-full w-full" style={{ border: `1px solid ${el.color || "#5A6A85"}`, background: el.fill || "transparent" }} />
      ) : el.type === "table" ? (
        <div className="h-full w-full border border-dashed border-brand-400 bg-brand-50/40 p-1 text-[9px] text-brand-600">
          ▦ Table · {(el.columns ?? []).map((c) => c.header).join(" · ")}
        </div>
      ) : (
        <span
          style={{
            fontSize: Math.max((el.fontSize ?? 11) * scale, 6),
            fontWeight: el.bold ? 700 : 400,
            fontStyle: el.italic ? "italic" : "normal",
            color: el.type === "image" ? "#5A6A85" : el.color || "#0D1B2A",
            width: "100%", display: "block",
            textAlign: (el.align as CanvasTextAlign) || "left",
          }}
        >
          {label}
        </span>
      )}
      {selected && (
        <span
          onPointerDown={onStartResize}
          className="absolute bottom-0 right-0 h-2.5 w-2.5 cursor-se-resize bg-brand-500"
        />
      )}
    </div>
  );
}

// ── Properties panel ────────────────────────────────────────────────────
function PropertiesPanel({
  el, fields, onChange, onDelete, onDuplicate,
}: {
  el: TemplateElement;
  fields: DocType["fields"];
  onChange: (patch: Partial<TemplateElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const num = (k: keyof TemplateElement, label: string, step = 1) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-500">{label}</span>
      <input
        type="number"
        step={step}
        value={Number(el[k] ?? 0)}
        onChange={(e) => onChange({ [k]: Number(e.target.value) } as Partial<TemplateElement>)}
        className="h-8 w-full rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
      />
    </label>
  );

  const textish = el.type === "text" || el.type === "field";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">{el.type}</span>
        <div className="flex gap-1">
          <button onClick={onDuplicate} title="Duplicate" className="rounded p-1 text-ink-400 hover:bg-ink-100">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={onDelete} title="Delete" className="rounded p-1 text-status-danger hover:bg-status-dangerBg">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {el.type === "text" && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-ink-500">Text</span>
          <input
            value={el.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
            className="h-8 w-full rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
          />
        </label>
      )}

      {el.type === "field" && (
        <Select
          label="Bind to field"
          value={el.field ?? ""}
          placeholder="Choose a field…"
          onChange={(e) => onChange({ field: e.target.value })}
          options={fields.map((f) => ({ value: f.key, label: f.label }))}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        {num("x", "X")}
        {num("y", "Y")}
        {num("w", "Width")}
        {el.type !== "line" && num("h", "Height")}
      </div>

      {textish && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {num("fontSize", "Font size")}
            <Select
              label="Align"
              value={el.align ?? "left"}
              onChange={(e) => onChange({ align: e.target.value as TemplateElement["align"] })}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-ink-600">
              <input type="checkbox" checked={!!el.bold} onChange={(e) => onChange({ bold: e.target.checked })} /> Bold
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink-600">
              <input type="checkbox" checked={!!el.italic} onChange={(e) => onChange({ italic: e.target.checked })} /> Italic
            </label>
          </div>
          <ColorField label="Colour" value={el.color ?? "#0D1B2A"} onChange={(v) => onChange({ color: v })} />
        </>
      )}

      {el.type === "line" && (
        <>
          {num("lineWidth", "Thickness")}
          <ColorField label="Colour" value={el.color ?? "#1D6FEB"} onChange={(v) => onChange({ color: v })} />
        </>
      )}

      {el.type === "box" && (
        <>
          <ColorField label="Border" value={el.color ?? "#5A6A85"} onChange={(v) => onChange({ color: v })} />
          <ColorField label="Fill (blank = none)" value={el.fill || "#ffffff"} onChange={(v) => onChange({ fill: v })} allowClear onClear={() => onChange({ fill: "" })} />
        </>
      )}

      {el.type === "table" && (
        <TableColumnsEditor el={el} onChange={onChange} />
      )}
    </Card>
  );
}

function ColorField({
  label, value, onChange, allowClear, onClear,
}: { label: string; value: string; onChange: (v: string) => void; allowClear?: boolean; onClear?: () => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-500">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded border border-ink-200 p-0.5" />
        <input aria-label="Value" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-8 flex-1 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500" />
        {allowClear && (
          <button onClick={onClear} className="text-xs text-ink-400 hover:text-ink-700">clear</button>
        )}
      </div>
    </label>
  );
}

function TableColumnsEditor({
  el, onChange,
}: { el: TemplateElement; onChange: (patch: Partial<TemplateElement>) => void }) {
  const cols = el.columns ?? [];
  const setCols = (next: typeof cols) => onChange({ columns: next });
  const patchCol = (i: number, patch: Partial<(typeof cols)[number]>) =>
    setCols(cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  // Field options for table rows are the row keys, which differ from the
  // letterhead field catalog; offer the common invoice row keys.
  const rowFieldOpts = useMemo(
    () => ["sno", "description", "qty", "rate", "amount"].map((k) => ({ value: k, label: k })),
    []
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Columns</span>
        <button
          onClick={() => setCols([...cols, { field: "description", header: "New", width: 1, align: "left", format: "text" }])}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          + Add
        </button>
      </div>
      {cols.map((c, i) => (
        <div key={i} className="rounded-lg border border-ink-100 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input aria-label="Column header" value={c.header} onChange={(e) => patchCol(i, { header: e.target.value })} placeholder="Header"
              className="h-7 flex-1 rounded border border-ink-200 px-1.5 text-xs focus:outline-none focus:border-brand-500" />
            <button onClick={() => setCols(cols.filter((_, idx) => idx !== i))} className="text-status-danger" title="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select aria-label="Column field" value={c.field} onChange={(e) => patchCol(i, { field: e.target.value })}
              className="h-7 rounded border border-ink-200 px-1 text-xs">
              {rowFieldOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select aria-label="Column format" value={c.format} onChange={(e) => patchCol(i, { format: e.target.value as typeof c.format })}
              className="h-7 rounded border border-ink-200 px-1 text-xs">
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="currency">currency</option>
            </select>
            <select aria-label="Column alignment" value={c.align} onChange={(e) => patchCol(i, { align: e.target.value as typeof c.align })}
              className="h-7 rounded border border-ink-200 px-1 text-xs">
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
            <input aria-label="Column width" type="number" step={0.5} value={c.width} onChange={(e) => patchCol(i, { width: Number(e.target.value) })}
              className="h-7 rounded border border-ink-200 px-1.5 text-xs" title="Relative width" />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-ink-400">
        Row fields (sno, description, qty, rate, amount) bind to each line item.
      </p>
    </div>
  );
}
