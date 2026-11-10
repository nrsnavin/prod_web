import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { StatTile } from "@/components/ui/StatTile";

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  to?: string;
  loading?: boolean;
  /** Paint the value in the danger color when attention is needed */
  alert?: boolean;
  footer?: ReactNode;
}

/** The dashboard's tile: the shared number tile, linked to its page. */
export function KpiTile({ label, value, icon, to, loading, alert, footer }: KpiTileProps) {
  return (
    <StatTile
      label={label}
      value={value}
      icon={icon}
      to={to}
      loading={loading}
      tone={alert ? "danger" : "default"}
      sub={footer}
      size="lg"
    />
  );
}
