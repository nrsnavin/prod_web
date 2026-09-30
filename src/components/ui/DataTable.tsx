import { ReactNode, useId, useMemo, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { cn } from "./cn";
import { naturalCompare } from "./naturalOrder";
import { useIsPhone } from "@/core/hooks/useMediaQuery";

// Generic, config-driven table (OCP: list pages declare columns, never
// re-implement table markup; LSP: works for any row type with an id).
export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
  /** When set, the header becomes click-to-sort using this accessor. */
  sort?: (row: T) => number | string;
  /** Extra classes for this column's cells — e.g. to allow wrapping a
   *  long cell that would otherwise overflow (overrides whitespace-nowrap). */
  cellClassName?: string;
  /**
   * Where this column goes in the phone card layout (see PhoneCards).
   * By default the first column is the card's title, a column keyed or
   * headed "status" is the badge beside it, and the rest are listed
   * below as label / value. `hide` drops a column that only makes sense
   * in a wide table.
   */
  phone?: "title" | "badge" | "hide";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * The query's failure, if it failed. Without this a 500 renders as
   * `rows = []` and the table claims there is nothing to show — the
   * single most damaging thing this component can do. Pass the query's
   * `error` and the table tells the truth instead.
   */
  error?: unknown;
  /** What could not be loaded, e.g. "machines". Used in the message. */
  errorWhat?: string;
  onRetry?: () => void;
  /** Column key to sort by on first render. Must name a sortable column. */
  defaultSortKey?: string;
  /** 1 ascending, -1 descending. Ignored without `defaultSortKey`. */
  defaultSortDir?: 1 | -1;
  /**
   * "cards" (default) turns each row into a card on a phone, so every
   * column is readable without sliding the table sideways. "table" keeps
   * the table for a grid whose columns only mean something side by side.
   */
  phoneLayout?: "cards" | "table";
  /** One-line empty state, for a table that is a section of a detail page. */
  compactEmpty?: boolean;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  columns,
  rows: rowsProp,
  rowKey,
  onRowClick,
  loading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  error,
  errorWhat,
  onRetry,
  defaultSortKey,
  defaultSortDir,
  phoneLayout = "cards",
  compactEmpty = false,
}: DataTableProps<T>) {
  const isPhone = useIsPhone();
  // Never crash on a missing/undefined rows prop — render empty instead.
  const rows = rowsProp ?? [];
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<1 | -1>(defaultSortDir ?? 1);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey && c.sort);
    if (!col?.sort) return rows;
    const acc = col.sort;
    return [...rows].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      // One comparator, shared with the floor board — see
      // naturalOrder.ts for why the two views must not each own a copy.
      const cmp = naturalCompare(va, vb);
      return cmp * sortDir;
    });
  }, [rows, columns, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };
  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  // Three branches, never two. A failed query is not an empty one, and
  // the error is checked FIRST — a failure that also happens to have no
  // rows must not fall through to "nothing here yet".
  if (error) {
    return <ErrorState error={error} what={errorWhat ?? "this"} onRetry={onRetry} />;
  }
  if (rows.length === 0) {
    return compactEmpty ? (
      // A table fills its card edge to edge; the one-line state does not.
      <div className="px-5 pb-5">
        <EmptyState compact title={emptyTitle} description={emptyDescription} />
      </div>
    ) : (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    );
  }
  if (isPhone && phoneLayout === "cards") {
    return (
      <PhoneCards
        columns={columns}
        rows={sorted}
        rowKey={rowKey}
        onRowClick={onRowClick}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key, dir) => {
          setSortKey(key);
          setSortDir(dir);
        }}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-ink-100">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                // Announced, not merely drawn: without this a screen
                // reader hears a button and no indication of which
                // column the table is currently ordered by.
                aria-sort={
                  c.sort
                    ? sortKey === c.key
                      ? sortDir === 1 ? "ascending" : "descending"
                      : "none"
                    : undefined
                }
                className={cn(
                  "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400 whitespace-nowrap",
                  alignClass[c.align ?? "left"]
                )}
              >
                {c.sort ? (
                  <button
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      "inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink-900",
                      sortKey === c.key && "text-ink-900"
                    )}
                  >
                    {c.header}
                    {sortKey === c.key &&
                      (sortDir === 1 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                "transition-colors",
                onRowClick &&
                  "cursor-pointer hover:bg-ink-100/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-sm whitespace-nowrap",
                    alignClass[c.align ?? "left"],
                    (c.align ?? "left") === "right" && "tabular-nums",
                    c.cellClassName
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  A TABLE ON A PHONE
//
//  A 390px screen shows two columns of a seven-column table. The rest —
//  usually including Status, the one thing somebody opened the list to
//  see — is off to the right, behind a sideways scroll nobody knows is
//  there. So below `sm` each row becomes a card: the first column as its
//  title, the status as a badge beside it, everything else as label and
//  value underneath. Same columns, same render functions, same row
//  click; nothing for a list page to do.
// ══════════════════════════════════════════════════════════════════

type PhoneRole = "title" | "badge" | "field" | "hide";

export function phoneRoles<T>(columns: Column<T>[]): PhoneRole[] {
  const explicitTitle = columns.some((c) => c.phone === "title");
  const explicitBadge = columns.some((c) => c.phone === "badge");
  let titleTaken = false;
  let badgeTaken = false;
  return columns.map((c, i) => {
    if (c.phone === "hide") return "hide";
    if (c.phone === "title" && !titleTaken) return (titleTaken = true), "title";
    if (c.phone === "badge" && !badgeTaken) return (badgeTaken = true), "badge";
    if (!explicitTitle && !titleTaken && i === 0) return (titleTaken = true), "title";
    if (!explicitBadge && !badgeTaken && (c.key === "status" || /^status$/i.test(c.header)))
      return (badgeTaken = true), "badge";
    return "field";
  });
}

function PhoneCards<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sortKey: string | null;
  sortDir: 1 | -1;
  onSort: (key: string, dir: 1 | -1) => void;
}) {
  const roles = phoneRoles(columns);
  const title = columns[roles.indexOf("title")];
  const badge = columns[roles.indexOf("badge")];
  const fields = columns.filter((_, i) => roles[i] === "field");
  const sortable = columns.filter((c) => c.sort);
  const sortId = useId();

  return (
    <div>
      {sortable.length > 0 && (
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2">
          <label htmlFor={sortId} className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Sort
          </label>
          <select
            id={sortId}
            value={sortKey ? `${sortKey}:${sortDir}` : ""}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":");
              if (key) onSort(key, dir === "-1" ? -1 : 1);
            }}
            className="h-9 flex-1 rounded-lg border border-ink-200 bg-surface px-2 text-sm text-ink-900"
          >
            {!sortKey && <option value="">Default order</option>}
            {sortable.flatMap((c) => [
              <option key={`${c.key}:1`} value={`${c.key}:1`}>{c.header} ↑</option>,
              <option key={`${c.key}:-1`} value={`${c.key}:-1`}>{c.header} ↓</option>,
            ])}
          </select>
        </div>
      )}
      <ul className="divide-y divide-ink-100">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                "block px-4 py-3",
                onRowClick &&
                  "cursor-pointer active:bg-ink-100/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-[15px] font-semibold leading-snug text-ink-900 break-words">
                  {title?.render(row)}
                </div>
                {badge && <div className="shrink-0">{badge.render(row)}</div>}
              </div>
              {fields.length > 0 && (
                <dl className="mt-2 space-y-1">
                  {fields.map((c) => (
                    <div key={c.key} className="flex items-baseline justify-between gap-3 text-sm">
                      {c.header && <dt className="shrink-0 text-ink-400">{c.header}</dt>}
                      <dd
                        className={cn(
                          "min-w-0 text-right text-ink-700 break-words",
                          !c.header && "ml-auto",
                          c.align === "right" && "tabular-nums"
                        )}
                      >
                        {c.render(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
