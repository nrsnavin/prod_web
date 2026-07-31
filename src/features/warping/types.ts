export type ProgrammeStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface ElasticOrderedLine {
  elastic: { _id: string; name: string } | string | null;
  quantity: number;
}

export interface Warping {
  _id: string;
  status: ProgrammeStatus;
  date?: string;
  completedDate?: string;
  job?: { _id: string; jobOrderNo: number; status?: string; customer?: { name?: string } } | null;
  elasticOrdered?: ElasticOrderedLine[];
  warpingPlan?: WarpingPlan | { _id: string; noOfBeams?: number } | null;
}

export interface WarpingPlanSection {
  warpYarn: { _id: string; name: string; unit?: string } | string | null;
  ends: number;
  // Run length in metres — persisted as `maxMeters` on the WarpingPlan
  // schema. (An earlier `length` alias never reached the DB.)
  maxMeters?: number;
}

export interface WarpingPlanBeam {
  beamNo?: number;
  totalEnds?: number;
  /** Set when this beam is run together with another — see beamCombine.ts. */
  pairedBeamNo?: number | null;
  sections: WarpingPlanSection[];
}

export interface WarpingPlan {
  _id: string;
  noOfBeams: number;
  beams: WarpingPlanBeam[];
  remarks?: string;
}

// One beam produced during covering — beamNo + weight (kg), optionally
// who recorded it. Powers the printable covering beam labels.
export interface BeamEntry {
  _id: string;
  beamNo: number;
  weight: number;
  note?: string;
  enteredAt?: string;
  enteredBy?: { _id?: string; name?: string; role?: string } | string | null;
}

export interface Covering {
  _id: string;
  status: ProgrammeStatus;
  date?: string;
  completedDate?: string;
  remarks?: string;
  job?: { _id: string; jobOrderNo: number; status?: string; customer?: { name?: string } } | null;
  elasticPlanned?: ElasticOrderedLine[];
  beamEntries?: BeamEntry[];
  // Auto-summed kg across beamEntries.
  producedWeight?: number;
}

export interface WarpYarnOption {
  id: string;
  name: string;
}

// ── Batches ─────────────────────────────────────────────────────────────
// A plan says what to build; a batch records which dye lots were actually
// drawn to build it. One plan is routinely run over several sittings from
// different lots, which is the whole reason the lot is worth recording.
export type BatchStatus = "planned" | "issued" | "completed" | "cancelled";

export interface BatchAllocation {
  rawMaterial: string;
  yarnLot: string | { _id: string; lotNo: string; shade?: string; status?: string };
  /** Snapshots taken at issue time, so the trail survives the lot record. */
  lotNo?: string;
  shade?: string;
  materialName?: string;
  quantity: number;
}

export interface WarpingBatch {
  _id: string;
  batchNo: string;
  warping: string;
  job?: { _id: string; jobOrderNo: number; status?: string } | string | null;
  beamNos: number[];
  allocations: BatchAllocation[];
  status: BatchStatus;
  issuedDate?: string;
  completedDate?: string;
  machine?: { _id: string; ID?: string } | string | null;
  remarks?: string;
}
