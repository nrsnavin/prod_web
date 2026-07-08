// Standard backend response envelope: { success: true, data: ... }
// Some legacy routes use entity-specific keys ({ user }, { orders }) —
// services unwrap those explicitly per endpoint.
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ListParams extends Record<string, unknown> {
  page?: number;
  limit?: number;
  search?: string;
}
