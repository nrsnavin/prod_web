import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Total row count — when given, shows "Showing a–b of total" */
  total?: number;
  pageSize?: number;
}

export function Pagination({ page, totalPages, onChange, total, pageSize = 20 }: PaginationProps) {
  if (totalPages <= 1 && !total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = total != null ? Math.min(page * pageSize, total) : page * pageSize;
  return (
    <div className="flex items-center justify-end gap-3 px-4 py-3">
      <span className="text-sm text-ink-400 tabular-nums">
        {total != null
          ? `Showing ${from}–${to} of ${total.toLocaleString("en-IN")}`
          : `Page ${page} of ${totalPages}`}
      </span>
      <div className="flex gap-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
