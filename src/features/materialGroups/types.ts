// ══════════════════════════════════════════════════════════════════
//  RAW MATERIAL GROUPS
//
//  This replaces the hardcoded MATERIAL_CATEGORIES list that used to
//  live in features/materials/types.ts. That list held four values;
//  the Flutter app held five; the server matched four literals by
//  exact string. So a material entered on the phone as "Chemicals"
//  could not be created here and matched no filter chip, and changing
//  the case of "Rubber" anywhere silently emptied the elastic recipe
//  picker.
//
//  Nothing is hardcoded here. The list comes from the server.
// ══════════════════════════════════════════════════════════════════

/**
 * Which question a group answers.
 *
 *  position — where the material sits in the cloth: warp, weft, covering
 *  material — what the material IS: rubber, chemicals, yarn
 *  other    — neither, or not decided yet
 *
 * The two axes shared one field for years, which is why the original
 * list read oddly: three positions and one substance.
 */
export type MaterialGroupKind = "position" | "material" | "other";

export const GROUP_KINDS: { value: MaterialGroupKind; label: string; hint: string }[] = [
  { value: "position", label: "Position in the cloth", hint: "Warp, weft, covering" },
  { value: "material", label: "What it is", hint: "Rubber, chemicals, yarn" },
  { value: "other", label: "Other", hint: "Anything else" },
];

export interface MaterialGroup {
  _id: string;
  name: string;
  /** Stable handle that does NOT move when the name is edited. */
  code: string;
  kind: MaterialGroupKind;
  sortOrder: number;
  colour: string;
  /** Copied onto a material at create time, not read through. */
  defaultUnit: string;
  defaultMinStock: number;
  notes: string;
  archived?: boolean;
  archivedAt?: string;
  /** Live members. Only present when the list was asked for `withCounts`. */
  materialCount?: number;
  /**
   * Live PLUS archived members. This — not `materialCount` — is what
   * decides archive-vs-delete, because an archived material still names
   * its group. Reading the live count alone made the confirm dialog
   * promise "removed outright" for a group the server then archived.
   */
  totalMaterialCount?: number;
}

export interface MaterialGroupFormValues {
  name: string;
  kind: MaterialGroupKind;
  sortOrder: number;
  colour: string;
  defaultUnit: string;
  defaultMinStock: number;
  notes: string;
}

export const emptyGroupForm: MaterialGroupFormValues = {
  name: "",
  kind: "other",
  sortOrder: 0,
  colour: "",
  defaultUnit: "kg",
  defaultMinStock: 0,
  notes: "",
};
