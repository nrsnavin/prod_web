import { useQuery } from "@tanstack/react-query";
import { orderService } from "@/features/orders/api";
import { breakdownService } from "./api";
import { BreakdownParams } from "./types";

export function useBreakdown(params: BreakdownParams) {
  return useQuery({
    queryKey: ["breakdown", params],
    queryFn: () => breakdownService.get(params),
    placeholderData: (prev) => prev, // keep the table up while a new range loads
  });
}

// In-flight orders + their AI-predicted completion dates in one hook.
// Orders are fetched first, then a single bulk ETA round-trip covers them.
export function useDeliveryForecast() {
  const orders = useQuery({
    queryKey: ["forecast-orders"],
    queryFn: async () => {
      // The forecast only plots in-flight work, which is a bounded set —
      // one page each is the whole picture, and /order/list is paged now.
      const [approved, inProgress] = await Promise.all([
        orderService.list("Approved", { limit: 500 }),
        orderService.list("InProgress", { limit: 500 }),
      ]);
      return [...inProgress.orders, ...approved.orders];
    },
  });

  const ids = (orders.data ?? []).map((o) => o._id);
  const etas = useQuery({
    queryKey: ["forecast-etas", ids],
    queryFn: () => breakdownService.runningEtaBulk(ids),
    enabled: ids.length > 0,
  });

  return { orders, etas };
}

export function useRunningEta(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["running-eta", orderId],
    queryFn: () => breakdownService.runningEta(orderId as string),
    enabled: Boolean(orderId) && enabled,
  });
}
