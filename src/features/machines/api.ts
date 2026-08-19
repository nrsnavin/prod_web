import { httpClient } from "@/core/http/httpClient";
import {
  Machine,
  MachineDetail,
  MachineFormValues,
  MachineHealthResponse,
  MachineStatus,
  MaintenanceDueItem,
  ServiceBill,
  ServiceBillUpload,
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

  async addServiceLog(
    machineId: string,
    body: ServiceLogFormValues
  ): Promise<{ log: { _id: string }; status: MachineStatus; statusChanged: boolean }> {
    return httpClient.post("/machine/add-service-log", { machineId, ...body });
  },

  // ── Service & spare bills ────────────────────────────────────────
  // Every bill for the machine in one request; the detail page groups them
  // by service log rather than firing a query per log.
  async serviceBills(machineId: string): Promise<ServiceBill[]> {
    const res = await httpClient.get<{ success: boolean; bills: ServiceBill[] }>(
      "/machine/service-bills",
      { machineId }
    );
    return res.bills;
  },

  async uploadServiceBill({ file, ...meta }: ServiceBillUpload): Promise<ServiceBill> {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(meta)) {
      if (value !== undefined && value !== null && value !== "") {
        form.append(key, String(value));
      }
    }
    const res = await httpClient.post<{ success: boolean; bill: ServiceBill }>(
      "/machine/service-bill",
      form
    );
    return res.bill;
  },

  async deleteServiceBill(id: string): Promise<void> {
    await httpClient.delete(`/machine/service-bill/${id}`);
  },

  // Fetched as a blob rather than linked directly: the auth cookie is
  // httpOnly and the API may be cross-origin in production, so a bare
  // <a href> would not carry credentials.
  async serviceBillFile(id: string): Promise<Blob> {
    return httpClient.getBlob(`/machine/service-bill/${id}/file`);
  },

  // Replace the machine's head → elastic map. Each entry pairs a head
  // number with an elastic id (or null to leave a head unthreaded).
  /**
   * `confirmHooks` goes ahead with a head map the machine cannot run as
   * specified — an elastic needing more hooks than the machine has. The
   * server refuses with HOOKS_EXCEED_MACHINE until it is set, the same
   * as the two job-side assignment routes.
   */
  async updateElasticMap(
    id: string,
    elastics: Array<{ head: number; elastic: string | null }>,
    confirmHooks = false
  ): Promise<void> {
    await httpClient.put("/machine/updateOrder", {
      id, elastics,
      ...(confirmHooks ? { confirmHooks: true } : {}),
    });
  },

  /**
   * Change how many heads a loom has.
   *
   * The server allows this only while the machine is FREE, and says so
   * with the current status in the message when it refuses. That refusal
   * is worth showing verbatim rather than flattening — "it is running"
   * is the whole answer, and the caller cannot work it out otherwise.
   */
  async updateHeads(machineId: string, noOfHead: number): Promise<{
    success: boolean; message: string;
    data: { machineId: string; machineID: string; noOfHead: number };
  }> {
    return httpClient.patch("/machine/update-heads", { machineId, noOfHead });
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
