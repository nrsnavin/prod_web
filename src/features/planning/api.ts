import { httpClient } from "@/core/http/httpClient";
import {
  AcceptedPlan, SuggestedPlan, MachinePlan, LearningResult, WeightsReport, PlanObjective,
} from "./types";

/** What an arrangement comes to, scored the way accepting it will be. */
export interface ScoredPlan {
  machines: MachinePlan[];
  objective: PlanObjective;
  /** Rows whose line is no longer waiting to be planned; left out of `machines`. */
  gone: { lineId: string | null; orderNo: number | null; elasticName: string }[];
}

export const plannerService = {
  suggest(horizonDays = 7): Promise<SuggestedPlan> {
    return httpClient.get<SuggestedPlan>("/planner/suggest-plan", { horizonDays });
  },

  /**
   * Accept a plan, possibly after editing it.
   *
   * `edited` is what the admin is accepting; `plan.machines` is what the
   * planner offered. BOTH go up, because the difference between them is
   * the only signal that can correct the objective's weights — the
   * server re-scores each one and learns from the gap. Sending only the
   * accepted plan would leave the correction unmeasurable, which is the
   * state this whole screen was in before.
   */
  accept(
    plan: SuggestedPlan,
    edited?: MachinePlan[]
  ): Promise<{
    success: boolean; planId: string; acceptedAt: string; learning: LearningResult;
  }> {
    return httpClient.post("/planner/accept", {
      generatedAt: plan.generatedAt,
      horizonDays: plan.horizonDays,
      objective: plan.objective,
      machines: edited ?? plan.machines,
      proposedMachines: plan.machines,
      assumptions: plan.assumptions,
      aiSuggestionId: plan.aiSuggestionId ?? null,
    });
  },

  /**
   * Score an arrangement without accepting it: every row's dates and
   * late days for where it now sits, and the totals. Called after each
   * move, so the screen shows the plan that is about to be accepted and
   * not the one that was proposed.
   */
  score(horizonDays: number, machines: MachinePlan[]): Promise<ScoredPlan> {
    return httpClient.post<ScoredPlan>("/planner/score", { horizonDays, machines });
  },

  latest(): Promise<{ success: boolean; plan: AcceptedPlan | null }> {
    return httpClient.get("/planner/latest");
  },

  weights(): Promise<{ success: boolean; data: WeightsReport }> {
    return httpClient.get("/planner/weights");
  },

  resetWeights(): Promise<{ success: boolean }> {
    return httpClient.post("/planner/weights/reset", {});
  },
};
