import { ReactNode } from "react";
import { cn } from "./cn";

// ══════════════════════════════════════════════════════════════════
//  A WIDE TABLE SHOULD SCROLL, NOT THE PAGE
//
//  DataTable wraps itself in a horizontal scroller, so most of the app
//  is fine on a phone. The hand-rolled tables did not, and on a narrow
//  screen the whole page slid sideways instead of the table — which
//  takes the header, the navigation and every other panel with it, and
//  leaves somebody scrolling right to read a column and then left again
//  to get back to anything else.
//
//  ── Why this is a component and not a copied className ───────────
//  Because of the print rule. Every one of these tables also appears on
//  a printed sheet — the DC, the PO, the packing slip — and a scroll
//  container in print is not merely useless: `overflow` establishes a
//  clipping box, so the columns past the fold are silently cut off the
//  paper rather than wrapped onto it. Printing a delivery challan that
//  quietly loses its last column is a worse bug than the one being
//  fixed here.
//
//  So the scroller is turned off for print, in one place, rather than
//  in seven places where the seventh gets forgotten.
// ══════════════════════════════════════════════════════════════════

export function TableScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto print:overflow-x-visible", className)}>
      {children}
    </div>
  );
}
