import { it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useMaterialsByCategory } from "./hooks";
import { useMaterialMutations } from "@/features/materials/hooks";

// ══════════════════════════════════════════════════════════════════
//  A RAW MATERIAL JUST ADDED IS IN THE ELASTIC FORM'S PICKER
//
//  The picker's list used to sit under its own cache key that no material
//  write invalidated, for five minutes — so a yarn added a moment ago was
//  missing when an elastic was created with it.
// ══════════════════════════════════════════════════════════════════

const byCategory = vi.fn();
const createMaterial = vi.fn();
vi.mock("./api", () => ({ elasticService: { materialsByCategory: () => byCategory() } }));
vi.mock("@/features/materials/api", () => ({ materialService: { create: (b: unknown) => createMaterial(b) } }));

const list = (...warp: string[]) => ({ warp: warp.map((name) => ({ _id: name, name })), weft: [], rubber: [], covering: [] });

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  byCategory.mockReset();
  createMaterial.mockReset();
});

it("adding a material refreshes the picker", async () => {
  byCategory.mockResolvedValueOnce(list("Poly 150D")).mockResolvedValueOnce(list("Poly 150D", "Nylon 70D"));
  createMaterial.mockResolvedValue({ _id: "n", name: "Nylon 70D" });
  const picker = renderHook(() => useMaterialsByCategory(), { wrapper });
  await waitFor(() => expect(picker.result.current.data?.warp).toHaveLength(1));

  const mutations = renderHook(() => useMaterialMutations(), { wrapper });
  await act(() => mutations.result.current.create.mutateAsync({ name: "Nylon 70D" } as never));

  await waitFor(() => expect(picker.result.current.data?.warp.map((m) => m.name)).toEqual(["Poly 150D", "Nylon 70D"]));
});

it("opening the form again fetches the list fresh, for materials added elsewhere", async () => {
  byCategory.mockResolvedValueOnce(list("Poly 150D")).mockResolvedValueOnce(list("Poly 150D", "Added by someone else"));
  const first = renderHook(() => useMaterialsByCategory(), { wrapper });
  await waitFor(() => expect(first.result.current.data?.warp).toHaveLength(1));
  first.unmount();

  const again = renderHook(() => useMaterialsByCategory(), { wrapper });
  await waitFor(() => expect(again.result.current.data?.warp).toHaveLength(2));
  expect(byCategory).toHaveBeenCalledTimes(2);
});
