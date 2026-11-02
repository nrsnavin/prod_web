import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { useDocumentSettings, useUpdateDocumentSettings } from "./hooks";
import type { InvoiceSettings } from "./types";

const EMPTY: InvoiceSettings = {
  defaultHsn: "5806",
  defaultGstPercent: 5,
  city: "",
  pincode: "",
  stateCode: "",
  bank: { name: "", account: "", ifsc: "", branch: "", upiId: "" },
  declaration: "",
  gsp: { provider: "", baseUrl: "", username: "", clientId: "", clientSecret: "", password: "" },
};

/**
 * What a tax invoice needs beyond the letterhead: the HSN and GST rate
 * that cover the catalogue (an elastic can override them), the seller's
 * city / PIN / state for the e-invoice, the bank the money goes to, and
 * the GSP that registers IRNs — or none, in which case the IRN is
 * pasted in from the portal.
 */
export function InvoiceSettingsForm() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const { data, isLoading, isError, error } = useDocumentSettings();
  const update = useUpdateDocumentSettings();
  const { toast } = useToast();
  const [form, setForm] = useState<InvoiceSettings>(EMPTY);

  useEffect(() => {
    if (data) {
      const inv: Partial<InvoiceSettings> = data.invoice ?? {};
      setForm({
        ...EMPTY,
        ...inv,
        bank: { ...EMPTY.bank, ...(inv.bank ?? {}) },
        gsp: { ...EMPTY.gsp, ...(inv.gsp ?? {}), clientSecret: "", password: "" },
      });
    }
  }, [data]);

  const set = <K extends keyof InvoiceSettings>(k: K, v: InvoiceSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setBank = (k: keyof InvoiceSettings["bank"], v: string) => setForm((f) => ({ ...f, bank: { ...f.bank, [k]: v } }));
  const setGsp = (k: keyof InvoiceSettings["gsp"], v: string) => setForm((f) => ({ ...f, gsp: { ...f.gsp, [k]: v } }));

  const save = () => {
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) return toast("PIN code must be 6 digits", "error");
    if (form.stateCode && !/^\d{2}$/.test(form.stateCode)) return toast("State code is the 2-digit GST code, e.g. 33", "error");
    if (!/^\d{4,8}$/.test(form.defaultHsn)) return toast("HSN is 4 to 8 digits", "error");
    const { configured: _configured, ...gsp } = form.gsp;
    update.mutate(
      { invoice: { ...form, gsp } },
      {
        onSuccess: () => toast("Invoice settings saved", "success"),
        onError: (e) => toast(e instanceof ApiError ? e.message : "Save failed", "error"),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError) return <ErrorBanner message={(error as Error).message} />;

  const configured = !!data?.invoice?.gsp?.configured;

  return (
    <div className="max-w-3xl space-y-6">
      {!canEdit && (
        <div className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          Only admins can change these. You're viewing them read-only.
        </div>
      )}

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-ink-900">Tax on the catalogue</h3>
        <p className="text-xs text-ink-400">
          One HSN and one GST rate for every elastic unless the elastic's own record says otherwise. Narrow woven
          elastic is 5806; most elastics are taxed at 5%.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Default HSN" value={form.defaultHsn} disabled={!canEdit} inputMode="numeric"
            onChange={(e) => set("defaultHsn", e.target.value.replace(/\D/g, "").slice(0, 8))} />
          <Input label="Default GST %" type="number" step="0.01" min={0} max={100} value={form.defaultGstPercent} disabled={!canEdit}
            onChange={(e) => set("defaultGstPercent", Number(e.target.value))} />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-ink-900">Seller address for the e-invoice</h3>
        <p className="text-xs text-ink-400">
          The portal wants the city, PIN and state apart from the address lines on the Documents tab. The state is
          read from your GSTIN when left blank.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="City" value={form.city} disabled={!canEdit} onChange={(e) => set("city", e.target.value)} />
          <Input label="PIN code" value={form.pincode} disabled={!canEdit} inputMode="numeric"
            onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <Input label="GST state code" placeholder="from GSTIN" value={form.stateCode} disabled={!canEdit} inputMode="numeric"
            onChange={(e) => set("stateCode", e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-ink-900">Bank details on the invoice</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Bank" value={form.bank.name} disabled={!canEdit} onChange={(e) => setBank("name", e.target.value)} />
          <Input label="Branch" value={form.bank.branch} disabled={!canEdit} onChange={(e) => setBank("branch", e.target.value)} />
          <Input label="Account number" value={form.bank.account} disabled={!canEdit} onChange={(e) => setBank("account", e.target.value)} />
          <Input label="IFSC" value={form.bank.ifsc} disabled={!canEdit} onChange={(e) => setBank("ifsc", e.target.value.toUpperCase())} />
          <Input label="UPI ID" placeholder="name@bank — printed with a scan-to-pay QR" value={form.bank.upiId} disabled={!canEdit}
            onChange={(e) => setBank("upiId", e.target.value.trim())} />
        </div>
        <div>
          <label htmlFor="invoice-declaration" className="mb-1.5 block text-sm font-medium text-ink-600">Declaration</label>
          <textarea
            id="invoice-declaration"
            rows={2}
            value={form.declaration}
            disabled={!canEdit}
            onChange={(e) => set("declaration", e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-ink-50"
          />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-900">e-Invoice provider (GSP)</h3>
          <StatusChip tone={configured ? "success" : "neutral"}>{configured ? "connected" : "not connected"}</StatusChip>
        </div>
        <p className="text-xs text-ink-400">
          With a provider connected, "Register IRN" on an invoice sends it to the portal and prints the signed QR.
          Without one, download the invoice's e-invoice JSON, register it on the portal, and paste the IRN back in.
          Secrets are stored on the server and never shown again; leave them blank to keep what is stored.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Provider"
            value={form.gsp.provider}
            disabled={!canEdit}
            onChange={(e) => setGsp("provider", e.target.value)}
            options={[
              { value: "", label: "None — paste the IRN from the portal" },
              { value: "http-json", label: "HTTP JSON (generic GSP proxy)" },
            ]}
          />
          <Input label="API base URL" value={form.gsp.baseUrl} disabled={!canEdit} placeholder="https://…/einvoice"
            onChange={(e) => setGsp("baseUrl", e.target.value)} />
          <Input label="Client ID" value={form.gsp.clientId} disabled={!canEdit} onChange={(e) => setGsp("clientId", e.target.value)} />
          <Input label="Client secret" type="password" value={form.gsp.clientSecret ?? ""} disabled={!canEdit}
            placeholder={configured ? "stored — leave blank to keep" : ""} autoComplete="new-password"
            onChange={(e) => setGsp("clientSecret", e.target.value)} />
          <Input label="Portal username" value={form.gsp.username} disabled={!canEdit} onChange={(e) => setGsp("username", e.target.value)} />
          <Input label="Portal password" type="password" value={form.gsp.password ?? ""} disabled={!canEdit}
            placeholder={configured ? "stored — leave blank to keep" : ""} autoComplete="new-password"
            onChange={(e) => setGsp("password", e.target.value)} />
        </div>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} loading={update.isPending}>
            <Save className="h-4 w-4" /> Save invoice settings
          </Button>
        </div>
      )}
    </div>
  );
}
