import { useDocumentSettings } from "@/features/settings/hooks";

/**
 * The company identity block for on-screen / printed documents (delivery
 * challan, purchase order). Reads the SAME Document Settings the PDF
 * layer uses, so the sheet you see matches the PDF that downloads —
 * previously these screens carried no company details at all, and the
 * address/GSTIN only ever appeared in the generated PDF.
 *
 * Renders nothing until settings load, so no placeholder company name is
 * ever printed.
 */
export function CompanyLetterhead({ docTitle, docSubtitle }: {
  docTitle: string;
  docSubtitle?: string;
}) {
  const { data: s } = useDocumentSettings();
  if (!s) return null;

  const contact = [
    s.phone && `Ph: ${s.phone}`,
    s.email,
    s.website,
  ].filter(Boolean);

  return (
    <div className="flex items-start justify-between gap-6 border-b border-ink-200 pb-4">
      <div className="flex items-start gap-3">
        {s.logo && (
          <img
            src={s.logo}
            alt=""
            className="h-12 w-12 shrink-0 object-contain"
          />
        )}
        <div className="text-sm">
          <p className="text-lg font-bold leading-tight" style={{ color: s.accentColor || undefined }}>
            {s.companyName}
          </p>
          {s.tagline && <p className="text-xs text-ink-400">{s.tagline}</p>}
          {s.addressLines.filter(Boolean).map((line, i) => (
            <p key={i} className="text-ink-600">{line}</p>
          ))}
          {s.gstin && <p className="text-ink-600">GSTIN: {s.gstin}</p>}
          {contact.length > 0 && <p className="text-ink-600">{contact.join(" · ")}</p>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <h1 className="text-xl font-bold">{docTitle}</h1>
        {docSubtitle && <p className="mt-0.5 text-sm text-ink-600">{docSubtitle}</p>}
      </div>
    </div>
  );
}

/**
 * Footer note + terms from Document Settings, shown under a printed
 * document. Renders nothing when neither is configured.
 */
export function CompanyDocumentFooter() {
  const { data: s } = useDocumentSettings();
  if (!s || (!s.footerNote && !s.termsText)) return null;

  return (
    <div className="mt-6 border-t border-ink-200 pt-3 text-xs text-ink-400">
      {s.termsText && <p className="whitespace-pre-wrap">{s.termsText}</p>}
      {s.footerNote && <p className={s.termsText ? "mt-2" : ""}>{s.footerNote}</p>}
    </div>
  );
}
