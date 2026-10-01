import { httpClient } from "@/core/http/httpClient";

/** A worker's way into the app, as an admin sees it. */
export interface WorkerAccess {
  employee: { id: string; name: string; phoneNumber: string | null; department: string | null };
  login: {
    id: string;
    /** Null for a worker login, which has no real address. */
    email: string | null;
    selfService: boolean;
    phoneSignIn: boolean;
    lockedUntil: string | null;
    since: string | null;
  } | null;
}

type Res = { success: boolean } & WorkerAccess;
const url = (empId: string) => `/user/manage/worker-access/${encodeURIComponent(empId)}`;
const pick = ({ employee, login }: Res): WorkerAccess => ({ employee, login });

export const workerAccessService = {
  async get(empId: string): Promise<WorkerAccess> {
    return pick(await httpClient.get<Res>(url(empId)));
  },
  /** Sets the PIN, creating the worker's login if they have none. */
  async setPin(empId: string, pin: string): Promise<WorkerAccess> {
    return pick(await httpClient.post<Res>(url(empId), { pin }));
  },
  async turnOff(empId: string): Promise<WorkerAccess> {
    return pick(await httpClient.delete<Res>(url(empId)));
  },
};
