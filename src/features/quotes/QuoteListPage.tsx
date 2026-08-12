import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { useQuotes } from "./hooks";
import { Quote, QuoteStatus } from "./types";
import { rupees } from "./costing";

export const quoteStatusTone: Record<QuoteStatus, "neutral" | "info" | "success" | "danger" | "warning"> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  declined: "danger",
  expired: "warning",
  cancelled: "danger",
};

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

const columns: Column<Quote>[] = [
  { key: "quoteNo", header: "Quote no", render: (q) => <span className="font-medium">{q.quoteNo}</span> },
  { key: "date", header: "Date", render: (q) => fmtDate(q.date) },
  { key: "customerName", header: "Customer", render: (q) => q.customerName },
  {
    // A quote can cover several widths; the list names the first and
    // says how many more, rather than truncating three names into a cell.
    key: "products",
    header: "Products",
    render: (q) => {
      const [first, ...rest] = q.lines ?? [];
      if (!first) return "—";
      return (
        <span>
          {first.productName}
          {rest.length > 0 && (
            <span className="ml-1 text-xs text-ink-400">+{rest.length} more</span>
          )}
        </span>
      );
    },
  },
  {
    key: "grandTotal",
    header: "Value",
    align: "right",
    render: (q) =>
      q.grandTotal > 0 ? (
        <span className="tabular-nums">
          ₹{rupees(q.grandTotal)}
          <span className="ml-1 text-xs text-ink-400">inc GST</span>
        </span>
      ) : (
        // Rate-only quotes are normal — "what would 20mm cost?" — and a
        // zero here would read as a price rather than an absence.
        <span className="text-ink-400">rate only</span>
      ),
  },
  {
    // A quote that has run out is not a quote any more, and the list is
    // where somebody notices before promising the price again.
    key: "validTill",
    header: "Valid till",
    render: (q) => {
      const expired = new Date(q.validTill) < new Date();
      return (
        <span className={expired ? "text-status-danger" : undefined}>
          {fmtDate(q.validTill)}
        </span>
      );
    },
  },
  {
    key: "status",
    header: "Status",
    render: (q) => <StatusChip tone={quoteStatusTone[q.status]}>{q.status}</StatusChip>,
  },
];

export function QuoteListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const { data, isLoading } = useQuotes({ page, status, search });

  return (
    <>
      <PageHeader
        title="Quotations"
        subtitle="Costed prices offered to customers"
        actions={
          <Link to="/quotes/new">
            <Button>
              <Plus className="h-4 w-4" /> New quotation
            </Button>
          </Link>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Quote no, customer or product"
        />
        <FilterChips
          value={status}
          onChange={(v) => { setStatus(v as QuoteStatus | "all"); setPage(1); }}
          options={[
            { value: "all", label: "All" },
            { value: "draft", label: "Draft" },
            { value: "sent", label: "Sent" },
            { value: "accepted", label: "Accepted" },
            { value: "declined", label: "Declined" },
          ]}
        />
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={data?.quotes ?? []}
          rowKey={(q) => q._id}
          loading={isLoading}
          onRowClick={(q) => navigate(`/quotes/${q._id}`)}
          emptyTitle="No quotations yet"
          emptyDescription="Cost a metre and offer a price."
        />
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / 20))}
          total={data?.total ?? 0}
          pageSize={20}
          onChange={setPage}
        />
      </Card>
    </>
  );
}

export default QuoteListPage;
