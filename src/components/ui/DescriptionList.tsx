import { ReactNode } from "react";

export interface DescriptionListProps {
  items: { label: string; value: ReactNode }[];
  columns?: 2 | 3;
}

// Label/value grid for detail pages.
export function DescriptionList({ items, columns = 2 }: DescriptionListProps) {
  return (
    <dl
      className={
        columns === 3
          ? "grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"
          : "grid gap-x-6 gap-y-4 sm:grid-cols-2"
      }
    >
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs text-ink-400">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink-900">
            {value ?? <span className="text-ink-400">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
