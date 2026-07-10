import { httpClient } from "@/core/http/httpClient";
import { AcceptedPlan, SuggestedPlan } from "./types";

export const plannerService = {
  suggest(horizonDays = 7): Promise<SuggestedPlan> {
    return httpClient.get<SuggestedPlan>("/planner/suggest-plan", { horizonDays });
  },

  accept(plan: SuggestedPlan): Promise<{ success: boolean; planId: string; acceptedAt: string }> {
    return httpClient.post("/planner/accept", {
      generatedAt: plan.generatedAt,
      horizonDays: plan.horizonDays,
      objective: plan.objective,
      machines: plan.machines,
      assumptions: plan.assumptions,
    });
  },

  latest(): Promise<{ success: boolean; plan: AcceptedPlan | null }> {
    return httpClient.get("/planner/latest");
  },
};
