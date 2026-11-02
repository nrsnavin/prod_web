import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoiceService } from "./api";
import type { EinvoiceStatus, InvoiceCreateBody, InvoiceStatus, IrnPasteBody } from "./types";
import { useRequestId } from "@/core/hooks/useRequestId";

export const INVOICES_KEY = "invoices";

export function useInvoices(params: { page: number; status: InvoiceStatus | "all"; einvoice: EinvoiceStatus | "all"; search: string }) {
  return useQuery({
    queryKey: [INVOICES_KEY, params],
    queryFn: () => invoiceService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: [INVOICES_KEY, "detail", id],
    queryFn: () => invoiceService.getById(id!),
    enabled: !!id,
  });
}

export function useInvoiceOrderInfo(orderId: string | undefined) {
  return useQuery({
    queryKey: [INVOICES_KEY, "order-info", orderId],
    queryFn: () => invoiceService.orderInfo(orderId!),
    enabled: !!orderId,
  });
}

export function useOrderInvoices(orderId: string | undefined) {
  return useQuery({
    queryKey: [INVOICES_KEY, "by-order", orderId],
    queryFn: () => invoiceService.byOrder(orderId!),
    enabled: !!orderId,
  });
}

export function useCustomerInvoices(customerId: string | undefined) {
  return useQuery({
    queryKey: [INVOICES_KEY, "by-customer", customerId],
    queryFn: () => invoiceService.byCustomer(customerId!),
    enabled: !!customerId,
  });
}

export function useInvoiceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [INVOICES_KEY] });
    qc.invalidateQueries({ queryKey: ["customer-recent"] });
  };
  // A resend of the same invoice is the same invoice: one number drawn.
  const ids = useRequestId();
  const create = useMutation({
    mutationFn: (body: InvoiceCreateBody) => invoiceService.create({ ...body, requestId: ids.for(body) }),
    onSuccess: () => {
      ids.done();
      invalidate();
    },
  });
  const registerIrn = useMutation({ mutationFn: (id: string) => invoiceService.registerIrn(id), onSuccess: invalidate });
  const pasteIrn = useMutation({
    mutationFn: ({ id, body }: { id: string; body: IrnPasteBody }) => invoiceService.pasteIrn(id, body),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => invoiceService.cancel(id, reason),
    onSuccess: invalidate,
  });
  return { create, registerIrn, pasteIrn, cancel };
}
