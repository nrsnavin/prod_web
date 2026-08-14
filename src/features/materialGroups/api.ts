import { httpClient } from "@/core/http/httpClient";
import { MaterialGroup, MaterialGroupFormValues } from "./types";
import { RawMaterial } from "../materials/types";

export const materialGroupService = {
  /**
   * The list every picker and filter chip is built from.
   *
   * `kind` narrows it — the elastic recipe pickers want positions only.
   * `withCounts` costs an extra aggregation, so only the settings
   * screen asks for it.
   */
  async list(params: {
    kind?: string;
    includeArchived?: boolean;
    withCounts?: boolean;
  } = {}): Promise<MaterialGroup[]> {
    const query: Record<string, unknown> = {};
    if (params.kind) query.kind = params.kind;
    if (params.includeArchived) query.includeArchived = "1";
    if (params.withCounts) query.withCounts = "1";
    const res = await httpClient.get<{ success: boolean; groups: MaterialGroup[] }>(
      "/material-group",
      query
    );
    return res.groups;
  },

  async create(values: MaterialGroupFormValues): Promise<MaterialGroup> {
    const res = await httpClient.post<{ success: boolean; group: MaterialGroup }>(
      "/material-group/create",
      values
    );
    return res.group;
  },

  /**
   * A rename cascades to every member's category, so the response says
   * how many materials moved — worth showing, because renaming a group
   * silently rewriting eighty rows is a surprise.
   */
  async update(
    id: string,
    values: Partial<MaterialGroupFormValues>
  ): Promise<{ group: MaterialGroup; materialsRenamed: number }> {
    const res = await httpClient.put<{
      success: boolean;
      group: MaterialGroup;
      materialsRenamed: number;
    }>("/material-group/update", { id, ...values });
    return { group: res.group, materialsRenamed: res.materialsRenamed ?? 0 };
  },

  /**
   * Archives if the group holds materials, deletes if it never did —
   * the same rule materials, elastics and customers already follow.
   * The response says which happened and why.
   */
  async remove(id: string): Promise<{ archived: boolean; materials?: number; message: string }> {
    return httpClient.delete<{ archived: boolean; materials?: number; message: string }>(
      `/material-group/${id}`
    );
  },

  async restore(id: string): Promise<MaterialGroup> {
    const res = await httpClient.post<{ success: boolean; group: MaterialGroup }>(
      "/material-group/restore",
      { id }
    );
    return res.group;
  },

  async materials(id: string): Promise<RawMaterial[]> {
    const res = await httpClient.get<{ success: boolean; materials: RawMaterial[] }>(
      `/material-group/${id}/materials`
    );
    return res.materials;
  },
};
