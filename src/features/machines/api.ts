import { httpClient } from "@/core/http/httpClient";
import {
  Machine,
  MachineDetail,
  MachineFormValues,
  MachineHealthResponse,
  MachineStatus,
  MaintenanceDueItem,
  ServiceLogFormValues,
} from "./types";

export const machineService = {
  async list(status?: MachineStatus | "all"): Promise<Machine[]> {
    const res = await httpClient.get<{ success: boolean; machines: Machine[] }>(
      "/machine/get-machines",
      status && status !== "all" ? { status } : undefined
    );
    return res.machines;
  },

  async getById(id: string): Promise<MachineDetail> {
    const res = await httpClient.get<{ success: boolean; machine: MachineDetail }>(
      "/machine/get-machine-detail",
      { id }
    );
    return res.machine;
  },

  async create(body: MachineFormValues): Promise<Machine> {
    const res = await httpClient.post<{ success: boolean; machine: Machine }>(
      "/machine/create-machine",
      body
    );
    return res.machine;
  },

  async setStatus(id: string, status: "free" | "maintenance"): Promise<void> {
    await httpClient.patch("/machine/status", { id, status });
  },

  async addServiceLog(machineId: string, body: ServiceLogFormValues): Promise<void> {
    await httpClient.post("/machine/add-service-log", { machineId, ...body });
  },

  async predictiveHealth(): Promise<MachineHealthResponse> {
    return httpClient.get<MachineHealthResponse>("/machine/predictive-health");
  },

  async healthAdvice(id: string): Promise<{ machineID: string; aiGenerated: boolean; advice: string }> {
    return httpClient.get(`/machine/health-advice/${id}`);
  },

  async maintenanceDue(days = 14): Promise<{
    count: number;
    overdueCount: number;
    data: MaintenanceDueItem[];
  }> {
    const res = await httpClient.get<{
      success: boolean;
      count: number;
      overdueCount: number;
      data: MaintenanceDueItem[];
    }>("/machine/maintenance-due", { days });
    return res;
  },
};
