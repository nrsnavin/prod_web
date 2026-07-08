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
  length?: number;
}

export interface WarpingPlanBeam {
  beamNo?: number;
  totalEnds?: number;
  sections: WarpingPlanSection[];
}

export interface WarpingPlan {
  _id: string;
  noOfBeams: number;
  beams: WarpingPlanBeam[];
  remarks?: string;
}

export interface Covering {
  _id: string;
  status: ProgrammeStatus;
  date?: string;
  completedDate?: string;
  remarks?: string;
  job?: { _id: string; jobOrderNo: number; status?: string; customer?: { name?: string } } | null;
  elasticPlanned?: ElasticOrderedLine[];
}

export interface WarpYarnOption {
  id: string;
  name: string;
}
