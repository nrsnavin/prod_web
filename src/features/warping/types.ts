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
  /** The dye lot this section runs off, chosen at programming time. */
  yarnLot?: { _id: string; lotNo: string; shade?: string; status?: string } | string | null;
  /** Snapshots — what the printed programme said, proof against the lot
   *  record being archived or renumbered later. Prefer these for display. */
  lotNo?: string;
  shade?: string;
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

/**
 * Lot-wise stock for one warp yarn, as of programming time.
 *
 * `largestLot` matters as much as `totalAvailable`: a beam wants to come
 * off a single lot, so 300 kg spread over six lots of 50 will not carry
 * a section that 300 kg on one lot would.
 */
export interface YarnLotStock {
  warpYarnId: string;
  warpYarnName: string;
  lots: Array<{ id: string; lotNo: string; shade: string; balance: number }>;
  totalAvailable: number;
  largestLot: number;
}

/**
 * A beam as the elastics' warping templates define it — merged across
 * every elastic on the job, exactly as the beams a warping raised on its
 * own would get. Filling the form from anything else would let a
 * hand-made plan disagree with an auto-made one for the same job.
 */
export interface TemplateBeam {
  beamNo: number;
  totalEnds: number;
  elasticId: string | null;
  elasticName: string;
  sections: Array<{
    warpYarnId: string;
    warpYarnName: string;
    ends: number;
    maxMeters: number;
  }>;
}

export interface PlanContext {
  success: boolean;
  jobId: string;
  warpYarns: WarpYarnOption[];
  lotStock: YarnLotStock[];
  /** Empty when no elastic on the job carries a template. */
  templateBeams?: TemplateBeam[];
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
  /** Empty when nobody said — the lot then traces only as far as the job. */
  elastics?: Array<{ _id: string; name: string } | string>;
  allocations: BatchAllocation[];
  status: BatchStatus;
  issuedDate?: string;
  completedDate?: string;
  machine?: { _id: string; ID?: string } | string | null;
  remarks?: string;
}
