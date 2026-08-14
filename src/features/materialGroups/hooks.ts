import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { materialGroupService } from "./api";
import { MaterialGroupFormValues } from "./types";

const KEY = "material-groups";

/**
 * The group list, for pickers and filter chips.
 *
 * Cached for a minute: the material form, the list page, the stock-count
 * scope picker and the MRP sheet all want it on the same visit, and it
 * changes about as often as the supplier list does.
 */
export function useMaterialGroups(params: {
  kind?: string;
  includeArchived?: boolean;
  withCounts?: boolean;
} = {}) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => materialGroupService.list(params),
    staleTime: 60_000,
  });
}

export function useGroupMaterials(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "materials", id],
    queryFn: () => materialGroupService.materials(id!),
    enabled: !!id,
  });
}

/**
 * Every mutation invalidates the MATERIALS cache as well as the groups.
 * A rename rewrites the category on every member, so a material list
 * left in cache would still be showing the old name — which is exactly
 * the drift this feature exists to remove, reintroduced in the browser.
 */
function useGroupMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useCreateGroup() {
  return useGroupMutation((values: MaterialGroupFormValues) =>
    materialGroupService.create(values)
  );
}

export function useUpdateGroup() {
  return useGroupMutation((args: { id: string; values: Partial<MaterialGroupFormValues> }) =>
    materialGroupService.update(args.id, args.values)
  );
}

export function useRemoveGroup() {
  return useGroupMutation((id: string) => materialGroupService.remove(id));
}

export function useRestoreGroup() {
  return useGroupMutation((id: string) => materialGroupService.restore(id));
}
