import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatDate } from "@/core/format/date";
import { useInvoices } from "./hooks";
import { money } from "./gst";
import { daysOverdue, einvoiceLabel, einvoiceTone, invoiceStatusTone, owed } from "./invoiceStatus";
import type { EinvoiceStatus, InvoiceStatus, InvoiceSummary } from "./types";
import { SavedViews, type ListView } from "@/components/ui/SavedViews";
import { useUrlNumber, useUrlState } from "@/core/hooks/useUrlState";
import { cn } from "@/components/ui/cn";


const issuedTotal = (rows: InvoiceSummary[]) => rows.filter((i) => i.status === "issued").reduce((s, i) => s + (i.totals?.grand ?? 0), 0);

const columns: Column<InvoiceSummary>[] = [
  { key: "no", header: "Invoice", sort: (i) => i.invoiceNumber, render: (i) => <span className="font-medium">{i.invoiceNumber}</span> },
  { key: "date", header: "Date", sort: (i) => new Date(i.invoiceDate).getTime(), render: (i) => formatDate(i.invoiceDate) },
  { key: "buyer", header: "Buyer", sort: (i) => i.buyer?.name ?? "", render: (i) => i.buyer?.name ?? "—" },
  { key: "order", header: "Order", render: (i) => (i.orderNo != null ? `#${i.orderNo}` : "—") },
  { key: "dcs", header: "Challans", defaultHidden: true, render: (i) => i.dcs.map((d) => d.dcNumber).join(", ") || "—", cellClassName: "whitespace-normal" },
  { key: "tax", header: "Tax", defaultHidden: true, render: (i) => (i.supplyType === "intra" ? "CGST+SGST" : i.supplyType === "export" ? "Export" : i.supplyType === "sez" ? "SEZ" : "IGST") },
  {
    key: "amount",
    header: "Total (₹)",
    align: "right",
    sort: (i) => i.totals?.grand ?? 0,
    render: (i) => <span className={cn(i.status === "cancelled" && "text-ink-400 line-through")}>{money(i.totals?.grand)}</span>,
    // Cancelled invoices are struck through above and left out here.
    total: (rows) => money(issuedTotal(rows)),
  },
  {
    key: "owed",
    header: "Payment",
    align: "right",
    sort: owed,
    render: (i) => {
      if (i.status !== "issued") return "—";
      const due = owed(i);
      if (due <= 0.005) return <span className="text-status-success">Paid</span>;
      const late = daysOverdue(i);
      const part = (i.paidAmount ?? 0) + (i.creditedAmount ?? 0) > 0;
      return (
        <span>
          {money(due)} {part ? "left" : "due"}
          <span className={cn("block text-xs", late > 0 ? "font-medium text-status-danger" : "text-ink-400")}>
            {late > 0 ? `${late} day${late === 1 ? "" : "s"} overdue` : late === 0 ? "due today" : `due in ${-late} day${late === -1 ? "" : "s"}`}
          </span>
        </span>
      );
    },
    total: (rows) => `${money(rows.reduce((s, i) => s + owed(i), 0))} owed`,
  },
  {
    key: "einvoice",
    header: "e-Invoice",
    render: (i) => {
      const s = (i.einvoice?.status ?? "pending") as EinvoiceStatus;
      return <StatusChip tone={einvoiceTone[s]}>{einvoiceLabel[s]}</StatusChip>;
    },
  },
  { key: "status", header: "Status", render: (i) => <StatusChip tone={invoiceStatusTone[i.status]}>{i.status}</StatusChip> },
];

const VIEWS: ListView[] = [
  { name: "All invoices", params: {} },
  { name: "Waiting for an IRN", params: { status: "issued", irn: "pending" } },
  { name: "Cancelled", params: { status: "cancelled" } },
];

export function InvoiceListPage() {
  const [page, setPage] = useUrlNumber("page", 1);
  const [status, setStatus] = useUrlState<InvoiceStatus | "all">("status", "all", ["all", "issued", "cancelled"]);
  const [einvoice, setEinvoice] = useUrlState<EinvoiceStatus | "all">("irn", "all", ["all", "pending", "registered", "cancelled"]);
  const [search, setSearch] = useUrlState<string>("q", "");
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useInvoices({ page, status, einvoice, search });

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={data ? `${data.total} invoices · raised from an order's page, against its delivery challans` : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SavedViews tableId="invoices" views={VIEWS} keys={["status", "irn", "q"]} />
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v, { page: null })}
          placeholder="Invoice no., buyer, GSTIN, IRN, challan or order no…"
          className="w-full max-w-xs"
        />
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: "issued", label: "Issued" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          value={status}
          onChange={(v) => setStatus(v, { page: null })}
        />
        <FilterChips
          options={[
            { value: "all", label: "Any IRN" },
            { value: "pending", label: "IRN pending" },
            { value: "registered", label: "IRN registered" },
          ]}
          value={einvoice}
          onChange={(v) => setEinvoice(v, { page: null })}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data?.invoices ?? []}
          rowKey={(i) => i._id}
          onRowClick={(i) => navigate(`/invoices/${i._id}`)}
          loading={isLoading}
          emptyTitle="No invoices yet"
          emptyDescription="Open an order and raise an invoice against its despatched challans."
          tableId="invoices"
          totalLabel={`${(data?.invoices ?? []).length} on this page`}
        />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
    </>
  );
}
