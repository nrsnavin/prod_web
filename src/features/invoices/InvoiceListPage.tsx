import { useState } from "react";
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
import { einvoiceLabel, einvoiceTone, invoiceStatusTone } from "./invoiceStatus";
import type { EinvoiceStatus, InvoiceStatus, InvoiceSummary } from "./types";

const columns: Column<InvoiceSummary>[] = [
  { key: "no", header: "Invoice", render: (i) => <span className="font-medium">{i.invoiceNumber}</span> },
  { key: "date", header: "Date", render: (i) => formatDate(i.invoiceDate) },
  { key: "buyer", header: "Buyer", render: (i) => i.buyer?.name ?? "—" },
  { key: "order", header: "Order", render: (i) => (i.orderNo != null ? `#${i.orderNo}` : "—") },
  { key: "dcs", header: "Challans", render: (i) => i.dcs.map((d) => d.dcNumber).join(", ") || "—", cellClassName: "whitespace-normal" },
  { key: "tax", header: "Tax", render: (i) => (i.supplyType === "inter" ? "IGST" : "CGST+SGST") },
  { key: "amount", header: "Total (₹)", align: "right", render: (i) => money(i.totals?.grand) },
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

export function InvoiceListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [einvoice, setEinvoice] = useState<EinvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useInvoices({ page, status, einvoice, search });

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={data ? `${data.total} invoices · raised from an order's page, against its delivery challans` : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
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
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <FilterChips
          options={[
            { value: "all", label: "Any IRN" },
            { value: "pending", label: "IRN pending" },
            { value: "registered", label: "IRN registered" },
          ]}
          value={einvoice}
          onChange={(v) => {
            setEinvoice(v);
            setPage(1);
          }}
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
        />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
    </>
  );
}
