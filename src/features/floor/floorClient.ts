import axios, { AxiosInstance } from "axios";
import { config } from "@/app/config";
import { toApiError } from "@/core/http/httpClient";
import type { CompleteResult, EntryInput, EntrySaved, FloorMachine, FloorSession, FloorState, Shift } from "./types";
import type { TimerReading } from "@/features/shifts/timerReading";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR TABLET'S OWN CLIENT
//
//  The floor-entry screen is opened with a shift PIN, not a login, so
//  it cannot share the app's HTTP client: that one sends the login
//  cookie and treats every 401 as "the session expired, go to /login".
//  Here a 401 means "enter the PIN again", handled on the screen.
//
//  The token is kept in sessionStorage — the tab, for the shift — so a
//  page reload or a tap on the wrong link does not cost the PIN. It is
//  the one thing kept; the shift's state is fetched fresh.
// ══════════════════════════════════════════════════════════════════

const TOKEN_KEY = "jarvis.floor.token";
const SESSION_KEY = "jarvis.floor.session";

export const floorTokenStore = {
  read(): { token: string; session: FloorSession } | null {
    try {
      const token = sessionStorage.getItem(TOKEN_KEY);
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!token || !raw) return null;
      const session = JSON.parse(raw) as FloorSession;
      if (!session?.dateKey || !session?.shift) return null;
      return { token, session };
    } catch {
      return null;
    }
  },
  write(token: string, session: FloorSession) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* a convenience only */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

function makeInstance(): AxiosInstance {
  const instance = axios.create({ baseURL: config.apiBaseUrl, timeout: 30_000 });
  instance.interceptors.request.use((req) => {
    const token = floorTokenStore.read()?.token;
    if (token) req.headers.set("X-Floor-Token", token);
    return req;
  });
  instance.interceptors.response.use((r) => r, (error) => Promise.reject(toApiError(error)));
  return instance;
}

let instance: AxiosInstance | null = null;
const http = () => (instance ??= makeInstance());

export interface OpenResult {
  token: string;
  session: FloorSession;
  state: FloorState;
}

export interface TimerPhotoResult {
  reading: TimerReading;
  suggestionId: string | null;
  photoId?: string | null;
}

export const floorService = {
  async open(input: { dateKey: string; shift: Shift; pin: string; name: string }): Promise<OpenResult> {
    const { data } = await http().post<OpenResult>("/floor/open", input);
    floorTokenStore.write(data.token, data.session);
    return data;
  },

  async shift(): Promise<FloorState> {
    const { data } = await http().get<{ state: FloorState }>("/floor/shift");
    return data.state;
  },

  /** One loom, by its QR label, its id, or its ID as typed. */
  async machine(code: string): Promise<FloorMachine> {
    const { data } = await http().get<{ machine: FloorMachine }>("/floor/machine", { params: { code } });
    return data.machine;
  },

  /** Puts the loom on the shift with this operator; the first loom makes the plan when nobody did. */
  async setOperator(machine: string, operator: string): Promise<{ detailId: string; added: boolean; planCreated: boolean }> {
    const { data } = await http().post<{ detailId: string; added: boolean; planCreated: boolean }>("/floor/operator", { machine, operator });
    return data;
  },

  async enter(input: EntryInput): Promise<EntrySaved> {
    const { data } = await http().post<EntrySaved>("/floor/entry", input);
    return { machine: data.machine, plan: data.plan ?? null };
  },

  /** Create shift plan: the looms noted become the plan. `force` with looms still to enter. */
  async complete(force = false): Promise<CompleteResult> {
    const { data } = await http().post<CompleteResult>("/floor/complete", force ? { force: true } : {});
    return data;
  },

  // ── The timer photo, for TimerPhotoReader ───────────────────────
  readTimerPhoto(photo: Blob, detailId?: string): Promise<TimerPhotoResult> {
    const form = new FormData();
    if (detailId) form.append("detailId", detailId); // before the file, so it is read first
    form.append("photo", photo, "timer.jpg");
    return http().post<TimerPhotoResult>("/floor/timer-photo", form).then((r) => r.data);
  },
  photoUsed(photoId: string, runTime: string): Promise<unknown> {
    return http().post(`/floor/timer-photo/${encodeURIComponent(photoId)}/use`, { runTime }).catch(() => undefined);
  },
};
