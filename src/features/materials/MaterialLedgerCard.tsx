import { useState } from "react";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { materialService } from "./api";
import { useMaterialLedger } from "./hooks";
import { LedgerRange, LedgerRow } from "./types";

// ══════════════════════════════════════════════════════════════════
//  STOCK MOVEMENT LEDGER, OVER A PERIOD
//
//  This replaces a fixed table of the newest 50 rows off the material's
//  embedded stockMovements array. That array is capped server-side, so
//  the old table could not answer "what moved in March" at all — and it
//  gave no sign that it couldn't. This asks the uncapped inward/outward
//  logs for an actual date range.
//
//  Two decisions worth keeping:
//
//  • The pickers write to `draft`, and only pressing Show copies draft
//    into `range`. So the table and the print link always describe the
//    same period. With the pickers bound straight to `range`, a
//    half-typed date would refetch on every keystroke and the PDF would
//    silently print whatever the boxes happened to hold.
//
//  • Opening and closing are rows OF the table, not notes beside it —
//    balance brought forward, the movements, balance carried forward.
//    That is how the sheet is read, and it matches the printed PDF.
// ══════════════════════════════════════════════════════════════════

const fmt = (n: number | undefined | null) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 3 })
    : "—";

/** The document behind a movement, linked where there is one to link to. */
export function RowReference({ row }: { row: LedgerRow }) {
  if (!row.reference) return <span className="text-ink-400">—</span>;
  const to =
    row.referenceKind === "order"
      ? `/orders/${row.referenceId}`
      : row.referenceKind === "purchaseOrder"
        ? `/purchase-orders/${row.referenceId}`
        : row.referenceKind === "job"
          ? `/jobs/${row.referenceId}`
          : null;
  return to && row.referenceId ? (
    <Link to={to} className="text-brand-600 hover:underline">
      {row.reference}
    </Link>
  ) : (
    <span>{row.reference}</span>
  );
}

/**
 * Exported so the columns can be tested directly.
 *
 * Reaching them through the card would mean mocking the query, the
 * router and the date pickers, and the test would then be about the
 * mock rather than about the cells.
 */
export const ledgerColumns = (unit: string): Column<LedgerRow>[] => [
  {
    key: "date",
    header: "Date",
    render: (r) => (r.date ? new Date(r.date).toLocaleDateString("en-IN") : "—"),
  },
  {
    key: "movement",
    header: "Movement",
    render: (r) => (
      <StatusChip tone={r.direction > 0 ? "success" : "danger"}>{r.label}</StatusChip>
    ),
  },
  { key: "reference", header: "Reference", render: (r) => <RowReference row={r} /> },
  {
    key: "details",
    header: "Details",
    cellClassName: "whitespace-normal",
    render: (r) => {
      const bits = [r.lotNo && `Lot ${r.lotNo}`, r.remarks].filter(Boolean);
      return bits.length ? (
        <span className="text-ink-600">{bits.join(" · ")}</span>
      ) : (
        <span className="text-ink-400">—</span>
      );
    },
  },
  {
    key: "in",
    header: `In (${unit})`,
    align: "right",
    render: (r) =>
      r.direction > 0 ? (
        <span className="text-status-success">{fmt(r.quantity)}</span>
      ) : (
        <span className="text-ink-300">—</span>
      ),
  },
  {
    key: "out",
    header: `Out (${unit})`,
    align: "right",
    render: (r) =>
      r.direction < 0 ? (
        <span className="text-status-danger">{fmt(r.quantity)}</span>
      ) : (
        <span className="text-ink-300">—</span>
      ),
  },
  {
    key: "balance",
    header: `Balance (${unit})`,
    align: "right",
    render: (r) => <span className="font-medium tabular-nums">{fmt(r.balance)}</span>,
  },
];

function Totals({
  opening,
  closing,
  received,
  issued,
  unit,
}: {
  opening: number;
  closing: number;
  received: number;
  issued: number;
  unit: string;
}) {
  const cells = [
    { label: `Opening (${unit})`, value: fmt(opening) },
    { label: `Received (${unit})`, value: fmt(received), tone: "text-status-success" },
    { label: `Issued (${unit})`, value: fmt(issued), tone: "text-status-danger" },
    { label: `Closing (${unit})`, value: fmt(closing) },
  ];
  // Every colour here is a theme token, and that is not incidental.
  // This strip shipped with a hardcoded white background and two stock
  // palette greens: in dark mode it was a white slab carrying near-white
  // numbers. `surface` is the raised sheet in whichever theme is on,
  // `ink-*` inverts, and `status-*` is tuned to stay legible as text on
  // either ground. The hairline between cells is the grid gap showing
  // `ink-100` through. See src/test/themeTokens.test.ts.
  return (
    <div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="bg-surface px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-ink-400">{c.label}</div>
          <div className={`text-lg font-semibold tabular-nums ${c.tone ?? "text-ink-900"}`}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MaterialLedgerCard({
  materialId,
  unit = "kg",
}: {
  materialId: string;
  unit?: string;
}) {
  const [draft, setDraft] = useState<LedgerRange>({ from: "", to: "" });
  const [range, setRange] = useState<LedgerRange>({ from: "", to: "" });
  const { data, isLoading, error, refetch } = useMaterialLedger(materialId, range);

  const apply = () => setRange(draft);
  const clear = () => {
    setDraft({ from: "", to: "" });
    setRange({ from: "", to: "" });
  };

  // Both ends set the wrong way round. The server refuses it, but saying
  // so here means the user finds out while typing rather than from a red
  // toast after pressing Show.
  const backwards = !!draft.from && !!draft.to && draft.from > draft.to;

  const openPdf = () => {
    window.open(materialService.ledgerPdfUrl(materialId, range), "_blank", "noopener");
  };

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div>
          <h3 className="font-semibold">Stock movements</h3>
          <p className="text-xs text-ink-500">
            Receipts and issues from the full history, not just the recent ones.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-500">
            <span className="mb-1 block">From</span>
            <Input
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              aria-label="From date"
            />
          </label>
          <label className="text-xs text-ink-500">
            <span className="mb-1 block">To</span>
            <Input
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              aria-label="To date"
            />
          </label>
          <Button variant="secondary" onClick={apply} disabled={backwards}>
            Show
          </Button>
          {(range.from || range.to) && (
            <Button variant="ghost" onClick={clear}>
              Clear
            </Button>
          )}
          <Button variant="secondary" onClick={openPdf} disabled={isLoading}>
            <Printer className="mr-1.5 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {backwards && (
        <p className="px-5 pt-2 text-xs text-status-danger">
          The From date is after the To date.
        </p>
      )}

      {data && (
        <div className="mt-4 border-y border-ink-100">
          <Totals
            opening={data.opening}
            closing={data.closing}
            received={data.totals.received}
            issued={data.totals.issued}
            unit={data.material.unit || unit}
          />
        </div>
      )}

      {/* The one thing a ledger must never do quietly: show a closing
          balance that is not the stock on the rack, without saying why. */}
      {data && data.stockNow !== data.closing && (
        <p className="px-5 pt-3 text-xs text-status-warning">
          Stock today is {fmt(data.stockNow)} {data.material.unit || unit} — movements after
          this period are not listed above.
        </p>
      )}

      <DataTable
        columns={ledgerColumns(data?.material.unit || unit)}
        rows={data?.rows ?? []}
        rowKey={(r) => r._id}
        loading={isLoading}
        error={error}
        errorWhat="stock movements"
        onRetry={() => refetch()}
        emptyTitle="No stock movements"
        emptyDescription={
          range.from || range.to
            ? "Nothing moved on this material in the selected period."
            : "Receipts, consumption and adjustments will appear here."
        }
      />
    </Card>
  );
}
