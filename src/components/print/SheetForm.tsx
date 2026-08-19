import { ReactNode } from "react";
import { TableScroll } from "@/components/ui/TableScroll";
import { cn } from "@/components/ui/cn";

/**
 * The printed-form visual language, shared by the shop-floor sheets — MRP,
 * warping programme, covering programme.
 *
 * Matches the server-rendered PDFs (utils/sapForm.js): a dense monochrome
 * business form of hairline-ruled boxes, small-caps labels above their
 * values, and grey-banded table headers. Deliberately unbranded and
 * near-monochrome, because these are working documents printed on a mono
 * laser and handed to a machine operator. Colour is used only where it
 * carries meaning bold cannot, and never as the only signal.
 *
 * Borders use ink-300 rather than a token that inverts, so the sheet reads
 * the same on paper whichever theme the screen is in.
 */

/** Document header: title block left, boxed title and identity grid right. */
export function SheetHeader({
  title,
  subtitle,
  company = "Balu Elastics",
  fields,
}: {
  title: string;
  subtitle?: string;
  company?: string;
  /** Small-caps label / value pairs for the identity box. */
  fields: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{company}</p>
          {subtitle && <p className="mt-0.5 text-xs text-ink-600">{subtitle}</p>}
        </div>
        <div className="w-64 shrink-0">
          <div className="border border-ink-900 px-3 py-2 text-center text-sm font-bold uppercase tracking-wide">
            {title}
          </div>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border border-ink-300 p-2">
            {fields.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-ink-600">
                  {f.label}
                </dt>
                <dd className="truncate text-xs">{f.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="mt-3 border-t-2 border-ink-900" />
    </>
  );
}

/** A ruled pane with a small-caps heading — consignee, customer, remarks. */
export function SheetPane({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-ink-300 p-2", className)}>
      <p className="text-[9px] font-bold uppercase tracking-wide text-ink-600">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

/** Section caption above a table. */
export function SheetSection({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-4 text-[10px] font-bold uppercase tracking-wide text-ink-600">
      {children}
    </p>
  );
}

/** Fully ruled table with a grey header band. */
export function SheetTable({
  head,
  children,
  className,
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TableScroll>
      <table className={cn("w-full border-collapse text-xs", className)}>
        <thead className="bg-ink-100 text-[10px] uppercase tracking-wide text-ink-900">
          {head}
        </thead>
        {children}
      </table>
    </TableScroll>
  );
}

/** Header cell. `align` mirrors the body cell so columns line up. */
export function Th({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <th
      colSpan={colSpan}
      className={cn(
        "border border-ink-300 px-2 py-1 font-semibold",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border border-ink-300 px-2 py-1",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}

/**
 * Signature strip. Three boxed cells with the label at the foot, leaving
 * the space above for an actual signature.
 */
export function SheetSignatures({
  labels = ["Prepared by", "Checked by", "Received by"],
}: {
  labels?: string[];
}) {
  return (
    <div
      className="mt-8 grid border border-ink-300 text-[10px] text-ink-600"
      style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
    >
      {labels.map((l, i) => (
        <div
          key={l}
          className={cn("px-2 pb-1.5 pt-9", i < labels.length - 1 && "border-r border-ink-300")}
        >
          {l}
        </div>
      ))}
    </div>
  );
}
