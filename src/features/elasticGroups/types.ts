export interface GroupElastic {
  _id: string;
  name: string;
  weaveType?: string;
}

export interface ElasticGroupItem {
  elastic: GroupElastic | string;
  defaultQuantity: number;
}

export interface ElasticGroup {
  _id: string;
  name: string;
  customer?: { _id: string; name: string } | null;
  items: ElasticGroupItem[];
  isActive?: boolean;
  updatedAt?: string;
}

export interface ElasticGroupFormValues {
  name: string;
  customer?: string; // "" → global
  items: Array<{ elastic: string; defaultQuantity: number }>;
}

// Resolve an item's elastic id whether populated or a bare id.
export function itemElasticId(it: ElasticGroupItem): string {
  return typeof it.elastic === "object" && it.elastic ? it.elastic._id : (it.elastic as string);
}
export function itemElasticName(it: ElasticGroupItem): string {
  return typeof it.elastic === "object" && it.elastic ? it.elastic.name : "—";
}
