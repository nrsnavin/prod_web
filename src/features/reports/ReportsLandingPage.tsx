import { Link } from "react-router-dom";
import { Factory, Truck, ClipboardList, Boxes, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";

interface ReportDef {
  title: string;
  description: string;
  icon: typeof Factory;
  path?: string; // present when the report is live
}

// The catalog. Production ships first; the rest land in later slices —
// listed here (disabled) so the section shows the full roadmap.
const REPORTS: { group: string; items: ReportDef[] }[] = [
  {
    group: "Operations",
    items: [
      {
        title: "Production report",
        description: "Meters produced over a period — by machine, shift, elastic, operator or day, with wastage and period comparison.",
        icon: Factory,
        path: "/reports/production",
      },
    ],
  },
  {
    group: "Commercial",
    items: [
      {
        title: "Dispatch & customer sales",
        description: "Delivery-challan register with quantity and value, grouped by customer.",
        icon: Truck,
        path: "/reports/dispatch",
      },
      {
        title: "Order book & fulfillment",
        description: "Open and pending orders by customer and supply date, plus on-time delivery.",
        icon: ClipboardList,
        path: "/reports/order-book",
      },
    ],
  },
  {
    group: "Inventory & Procurement",
    items: [
      {
        title: "Stock & purchases",
        description: "Raw-material stock and valuation, movement ledger, and PO register (received vs pending).",
        icon: Boxes,
      },
    ],
  },
];

function ReportCard({ def }: { def: ReportDef }) {
  const Icon = def.icon;
  const live = !!def.path;

  const inner = (
    <Card
      className={
        "flex h-full flex-col p-5 transition " +
        (live ? "cursor-pointer hover:shadow-card-hover" : "opacity-60")
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </span>
        {live ? (
          <ArrowRight className="h-4 w-4 text-ink-300" />
        ) : (
          <StatusChip tone="neutral">Coming soon</StatusChip>
        )}
      </div>
      <h3 className="font-semibold">{def.title}</h3>
      <p className="mt-1 text-sm text-ink-500">{def.description}</p>
    </Card>
  );

  return live ? <Link to={def.path!}>{inner}</Link> : inner;
}

export function ReportsLandingPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Pull operational and commercial reports over any period" />
      <div className="space-y-6">
        {REPORTS.map((section) => (
          <div key={section.group}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
              {section.group}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((def) => (
                <ReportCard key={def.title} def={def} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
