import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Save, FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { useDocumentSettings, useUpdateDocumentSettings } from "./hooks";
import { DocumentSettings } from "./types";

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const LOGO_MAX_BYTES = 300 * 1024; // keep the base64 well under the schema cap

const EMPTY: DocumentSettings = {
  companyName: "",
  tagline: "",
  addressLines: [],
  gstin: "",
  phone: "",
  email: "",
  website: "",
  footerNote: "",
  termsText: "",
  accentColor: "#1D6FEB",
  logo: "",
};

export function DocumentSettingsForm() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const { data, isLoading, isError, error } = useDocumentSettings();
  const update = useUpdateDocumentSettings();
  const { toast } = useToast();

  const [form, setForm] = useState<DocumentSettings>(EMPTY);
  const [addressText, setAddressText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydrate local state once settings load (and on refetch).
  useEffect(() => {
    if (data) {
      setForm({ ...EMPTY, ...data });
      setAddressText((data.addressLines ?? []).join("\n"));
    }
  }, [data]);

  const set = <K extends keyof DocumentSettings>(k: K, v: DocumentSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onPickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast("Logo must be a PNG, JPEG or WebP image", "error");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast("Logo is too large — keep it under 300 KB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (form.accentColor && !HEX.test(form.accentColor)) {
      toast("Accent colour must be a hex value like #1D6FEB", "error");
      return;
    }
    const addressLines = addressText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6);
    update.mutate(
      { ...form, addressLines },
      {
        onSuccess: () => toast("Document settings saved — new PDFs will use them", "success"),
        onError: (e) => toast(e instanceof ApiError ? e.message : "Save failed", "error"),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError) return <ErrorBanner message={(error as Error).message} />;

  const accent = HEX.test(form.accentColor) ? form.accentColor : "#1D6FEB";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ── Form ─────────────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-6">
        {!canEdit && (
          <div className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
            Only admins can change these. You're viewing them read-only.
          </div>
        )}

        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink-900">Company identity</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company name" value={form.companyName} disabled={!canEdit}
              onChange={(e) => set("companyName", e.target.value)} />
            <Input label="Tagline" value={form.tagline} disabled={!canEdit}
              onChange={(e) => set("tagline", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1.5">Address</label>
            <textarea
              value={addressText}
              disabled={!canEdit}
              onChange={(e) => setAddressText(e.target.value)}
              rows={3}
              placeholder={"One line per row\ne.g. 12 Mill Road\nErode, Tamil Nadu 638001"}
              className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:bg-ink-50"
            />
            <p className="mt-1 text-xs text-ink-400">Up to 6 lines. Blank lines are ignored.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="GSTIN" value={form.gstin} disabled={!canEdit}
              onChange={(e) => set("gstin", e.target.value)} />
            <Input label="Phone" value={form.phone} disabled={!canEdit}
              onChange={(e) => set("phone", e.target.value)} />
            <Input label="Email" value={form.email} disabled={!canEdit}
              onChange={(e) => set("email", e.target.value)} />
            <Input label="Website" value={form.website} disabled={!canEdit}
              onChange={(e) => set("website", e.target.value)} />
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink-900">Branding</h3>
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1.5">Accent colour</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accent}
                  disabled={!canEdit}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="h-10 w-12 rounded-lg border border-ink-200 bg-surface p-1 disabled:opacity-60"
                />
                <Input aria-label="Accent colour hex code" value={form.accentColor} disabled={!canEdit}
                  onChange={(e) => set("accentColor", e.target.value)} className="w-28" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink-600 mb-1.5">Logo</label>
              <div className="flex items-center gap-3">
                {form.logo ? (
                  <img src={form.logo} alt="logo" className="h-10 w-auto rounded border border-ink-100" />
                ) : (
                  <span className="text-xs text-ink-400">No logo</span>
                )}
                {canEdit && (
                  <>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
                      className="hidden" onChange={(e) => onPickLogo(e.target.files?.[0])} />
                    <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4" /> Upload
                    </Button>
                    {form.logo && (
                      <Button size="sm" variant="ghost" onClick={() => set("logo", "")}>
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-400">PNG/JPEG/WebP, under 300 KB.</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink-900">Footer &amp; terms</h3>
          <Input label="Footer note" value={form.footerNote} disabled={!canEdit}
            onChange={(e) => set("footerNote", e.target.value)}
            placeholder="e.g. This is a computer-generated document." />
          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1.5">Terms &amp; conditions</label>
            <textarea
              value={form.termsText}
              disabled={!canEdit}
              onChange={(e) => set("termsText", e.target.value)}
              rows={4}
              placeholder="Shown at the bottom of documents that carry terms (e.g. POs)."
              className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:bg-ink-50"
            />
          </div>
        </Card>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={save} loading={update.isPending}>
              <Save className="h-4 w-4" /> Save document settings
            </Button>
          </div>
        )}
      </div>

      {/* ── Live preview ─────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
          Preview — PDF header
        </p>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            {form.logo && <img src={form.logo} alt="logo" className="h-10 w-auto" />}
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight" style={{ color: accent }}>
                {form.companyName || "Company name"}
              </p>
              {form.tagline && <p className="text-xs text-ink-500">{form.tagline}</p>}
              <div className="mt-2 text-[11px] leading-relaxed text-ink-500">
                {addressText
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l, i) => <p key={i}>{l}</p>)}
                {form.gstin && <p>GSTIN: {form.gstin}</p>}
                {(form.phone || form.email) && (
                  <p>{[form.phone, form.email].filter(Boolean).join("  ·  ")}</p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full rounded" style={{ backgroundColor: accent }} />
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-400">
            <FileText className="h-3.5 w-3.5" />
            Applies to reports, shift sheets, MRP &amp; other generated PDFs.
          </p>
          {form.footerNote && (
            <p className="mt-3 border-t border-ink-100 pt-2 text-[10px] text-ink-400">
              {form.footerNote}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
