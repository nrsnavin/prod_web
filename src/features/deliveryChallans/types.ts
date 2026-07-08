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
