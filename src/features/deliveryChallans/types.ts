export type DcStatus = "draft" | "dispatched" | "delivered" | "cancelled";
export type DcType = "elastic" | "machine_part";

export interface DcItem {
  _id?: string;
  elastic?: { _id: string; name: string } | string | null;
  elasticName?: string;
  description?: string;
  unit?: string;
  quantity: number;
  rate: number;
  amount?: number;
}

export interface DeliveryChallan {
  _id: string;
  dcNumber: string;
  type: DcType;
  status: DcStatus;
  order?: { _id: string; orderNo: number; status?: string } | string | null;
  orderNo?: number;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  dispatchDate?: string;
  vehicleNo?: string;
  driverName?: string;
  transporter?: string;
  lrNumber?: string;
  items?: DcItem[];
  totalQuantity?: number;
  totalAmount?: number;
  remarks?: string;
  createdAt?: string;
}

export interface DcOrderInfo {
  orderNo: number;
  customer: { name: string; phone: string; gstin: string; contact: string };
  elastics: Array<{
    elasticId: string;
    elasticName: string;
    weaveType: string;
    orderedQty: number;
  }>;
}

export interface DcFormItem {
  elastic?: string;
  elasticName?: string;
  description?: string;
  quantity: number;
  rate: number;
}

/**
 * An edit to a challan that has already been raised.
 *
 * `items` is optional and meaningful by its absence: leaving it out
 * edits only the despatch detail, while sending it makes the backend
 * reverse every existing line and re-apply the new ones — which moves
 * stock. So the edit form only sends it when the lines actually changed.
 */
export interface DcUpdateBody {
  id: string;
  auditReason: string;
  items?: DcFormItem[];
  customerName?: string;
  dispatchDate?: string;
  vehicleNo?: string;
  driverName?: string;
  transporter?: string;
  lrNumber?: string;
  remarks?: string;
}

export interface DcFormValues {
  type: DcType;
  orderId?: string;
  orderNo?: number;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  dispatchDate?: string;
  vehicleNo?: string;
  driverName?: string;
  transporter?: string;
  lrNumber?: string;
  items: DcFormItem[];
  remarks?: string;
}
