import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { useDocumentSettings, useUpdateDocumentSettings } from "@/features/settings/hooks";
import { useInvoiceMutations } from "./hooks";
import { stateCodeFromGstin } from "./gst";
import type { Invoice } from "./types";

const LOGO_MAX_BYTES = 300 * 1024; // as in Settings → Documents & Branding

/**
 * The company's details and logo, as they print at the top of the
 * invoice, edited from the invoice itself. They are the ones in Settings
 * → Documents & Branding (and the city and PIN code in Settings →
 * Invoice), so every invoice and challan made after this uses them.
 *
 * An invoice keeps the details it was raised with. One not yet
 * registered with the e-invoice portal can take the new ones too; its
 * number, lines and amounts stay as they are. The logo is not part of
 * the invoice: every PDF prints the current one.
 */
export function CompanyDetailsDialog({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const { toast } = useToast();
  const { data, isLoading } = useDocumentSettings();
  const update = useUpdateDocumentSettings();
  const { adoptCompanyDetails } = useInvoiceMutations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState("");
  const registered = invoice.einvoice?.status === "registered";
  const cancelled = invoice.status === "cancelled";
  const canAdopt = !registered && !cancelled;
  const [adopt, setAdopt] = useState(canAdopt);

  // Filled from Settings once, when they arrive: a refetch must not wipe
  // what is being typed.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!data || !open || filled) return;
    setFilled(true);
    setName(data.companyName ?? "");
    setAddress((data.addressLines ?? []).join("\n"));
    setCity(data.invoice?.city ?? "");
    setPincode(data.invoice?.pincode ?? "");
    setGstin(data.gstin ?? "");
    setPhone(data.phone ?? "");
    setEmail(data.email ?? "");
    setLogo(data.logo ?? "");
  }, [data, open, filled]);

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast("The logo must be a PNG, JPEG or WebP image", "error"); return; }
    if (file.size > LOGO_MAX_BYTES) { toast("The logo is too large: keep it under 300 KB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  };

  const gstinClean = gstin.trim().toUpperCase();
  const state = stateCodeFromGstin(gstinClean);
  const gstinError = gstinClean && !state ? "15 characters, like 33AAECB1234F1Z5" : undefined;
  const pinError = pincode.trim() && !/^\d{6}$/.test(pincode.trim()) ? "6 digits" : undefined;
  const busy = update.isPending || adoptCompanyDetails.isPending;

  const putOnInvoice = async () => {
    try {
      const r = await adoptCompanyDetails.mutateAsync(invoice._id);
      return r.unchanged ? "already" : "done";
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "This invoice could not take the new details", "error");
      return "failed";
    }
  };

  const save = async () => {
    if (gstinError || pinError) { toast("Check the GSTIN and PIN code", "error"); return; }
    if (canEdit) {
      try {
        await update.mutateAsync({
          companyName: name.trim(),
          addressLines: address.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6),
          gstin: gstinClean,
          phone: phone.trim(),
          email: email.trim(),
          logo,
          invoice: { city: city.trim(), pincode: pincode.trim() },
        });
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "The company details could not be saved", "error");
        return;
      }
    }
    const onInvoice = canAdopt && adopt ? await putOnInvoice() : "skipped";
    if (onInvoice === "failed") return;
    toast(
      onInvoice === "done"
        ? "Saved, and this invoice now carries them. New invoices and challans will use them too."
        : "Saved. New invoices and challans will use them.",
      "success"
    );
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Company details & logo" width="max-w-2xl">
      {isLoading || !data ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-ink-500">
            These print at the top of every invoice and challan. They are the same as in Settings → Documents &amp; Branding.
          </p>
          {!canEdit && (
            <p className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
              Only an admin can change the company details. You can still put the current ones on this invoice.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Company name" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} wrapperClassName="sm:col-span-2" />
            <div className="sm:col-span-2">
              <label htmlFor="company-address" className="mb-1.5 block text-sm font-medium text-ink-600">Address</label>
              <textarea
                id="company-address"
                rows={2}
                value={address}
                disabled={!canEdit}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={"Door no., street\nArea"}
                className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
              />
              <p className="mt-1 text-xs text-ink-400">One line per row; the city and PIN code go below.</p>
            </div>
            <Input label="City" value={city} disabled={!canEdit} onChange={(e) => setCity(e.target.value)} />
            <Input label="PIN code" inputMode="numeric" value={pincode} disabled={!canEdit} error={pinError}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            <Input label="GSTIN" value={gstin} disabled={!canEdit} error={gstinError}
              hint={state ? `State code ${state}` : undefined}
              onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))} />
            <Input label="Phone" value={phone} disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Email" type="email" value={email} disabled={!canEdit} onChange={(e) => setEmail(e.target.value)} wrapperClassName="sm:col-span-2" />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-600">Logo</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-16 w-28 place-items-center overflow-hidden rounded-lg border border-ink-200 bg-surface">
                {logo ? <img src={logo} alt="Company logo" className="max-h-14 max-w-24 object-contain" /> : <span className="text-xs text-ink-400">No logo</span>}
              </div>
              {canEdit && (
                <>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    aria-label="Choose a logo image" onChange={(e) => pickLogo(e.target.files?.[0])} />
                  <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> {logo ? "Change" : "Upload"}
                  </Button>
                  {logo && (
                    <Button size="sm" variant="ghost" onClick={() => setLogo("")}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </>
              )}
              <p className="text-xs text-ink-400">PNG, JPEG or WebP, under 300 KB. Prints on every PDF, this one included.</p>
            </div>
          </div>

          <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm">
            {cancelled ? (
              <p className="text-ink-600">This invoice is cancelled and keeps the details it had.</p>
            ) : registered ? (
              <p className="text-ink-600">
                This invoice is registered with the e-invoice portal, which signed its details: it keeps the ones it was issued with.
                New invoices will use these.
              </p>
            ) : (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={adopt} onChange={(e) => setAdopt(e.target.checked)} />
                <span>
                  <span className="font-medium text-ink-900">Use them on {invoice.invoiceNumber} too</span>
                  <span className="block text-xs text-ink-500">Its number, lines and amounts stay as they are.</span>
                </span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={busy} disabled={!canEdit && !(canAdopt && adopt)}>
              {canEdit ? "Save" : "Put them on this invoice"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
