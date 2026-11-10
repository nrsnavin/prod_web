import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Cpu, KeyRound, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InlineConfirm } from "@/components/ui/InlineConfirm";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/core/auth/useAuth";
import { ApiError, httpClient } from "@/core/http/httpClient";
import { machineService } from "@/features/machines/api";

// ══════════════════════════════════════════════════════════════════
//  LOOM SENSORS — the boards that count a loom's run time (api/loomSensor.js)
//
//  The admin adds a board for a loom and copies its key, shown this once,
//  into the board's secrets (tools/loom-sensor/README.md). A lost board
//  gets a new key, which retires the old at once.
// ══════════════════════════════════════════════════════════════════

export interface LoomDeviceRow {
  id: string;
  machine: { id: string; ID: string | null };
  name: string;
  keyId: string;
  active: boolean;
  live: boolean;
  lastSeenAt: string | null;
  lastReading: { at: string; runSecondsTotal: number; picksTotal?: number | null; running?: boolean | null } | null;
  firmware: string;
}

export const sensorService = {
  list: async () => (await httpClient.get<{ success: boolean; devices: LoomDeviceRow[] }>("/loom-sensor/devices")).devices,
  add: (body: { machine: string; name?: string }) => httpClient.post<{ success: boolean; device: LoomDeviceRow; key: string }>("/loom-sensor/devices", body),
  newKey: (id: string) => httpClient.post<{ success: boolean; device: LoomDeviceRow; key: string }>(`/loom-sensor/devices/${encodeURIComponent(id)}/key`, {}),
  remove: (id: string) => httpClient.delete<{ success: boolean }>(`/loom-sensor/devices/${encodeURIComponent(id)}`),
};

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
};

export function LoomSensors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const { data } = useQuery({ queryKey: ["loom-sensors"], queryFn: sensorService.list, enabled: isAdmin, refetchInterval: 60_000 });
  const machines = useQuery({ queryKey: ["machines", "all"], queryFn: () => machineService.list("all"), enabled: isAdmin, staleTime: 5 * 60_000 });
  const [adding, setAdding] = useState(false);
  const [machine, setMachine] = useState("");
  const [name, setName] = useState("");
  // The key, shown once, with the loom it is for.
  const [shown, setShown] = useState<{ key: string; loom: string } | null>(null);

  const done = (r: { device: LoomDeviceRow; key: string }) => {
    qc.invalidateQueries({ queryKey: ["loom-sensors"] });
    setShown({ key: r.key, loom: r.device.machine.ID ?? "the loom" });
    setAdding(false); setMachine(""); setName("");
  };
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "Could not do that", "error");
  const add = useMutation({ mutationFn: () => sensorService.add({ machine, name }), onSuccess: done, onError: fail });
  const rekey = useMutation({ mutationFn: (id: string) => sensorService.newKey(id), onSuccess: done, onError: fail });
  const remove = useMutation({
    mutationFn: (id: string) => sensorService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loom-sensors"] }); toast("Removed — its posts are refused now", "success"); },
    onError: fail,
  });

  if (!isAdmin) return null;
  const active = (data ?? []).filter((d) => d.active);
  const taken = new Set(active.map((d) => d.machine.id));

  return (
    <Card className="mt-6 p-4" aria-label="Loom sensors">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><Cpu className="h-4 w-4 text-ink-400" aria-hidden /> Loom sensors</h3>
        <Button size="sm" variant="secondary" onClick={() => setAdding((x) => !x)}><Plus className="h-4 w-4" aria-hidden /> Add</Button>
      </div>
      <p className="text-xs text-ink-400">A board on the loom counts its run time; the floor gets it without reading a timer, and auto-verification takes it as evidence. Setting one up: tools/loom-sensor/README.md.</p>

      {adding && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-ink-100 p-3">
          <Select
            label="Loom"
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            placeholder="Choose…"
            options={(machines.data ?? []).filter((m) => !taken.has(m._id)).map((m) => ({ value: m._id, label: m.ID }))}
          />
          <Input label="Name (optional)" placeholder="ESP32 by the panel" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" disabled={!machine} loading={add.isPending} onClick={() => add.mutate()}>Add and show the key</Button>
        </div>
      )}

      {active.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No sensors yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs text-ink-500 font-medium">
                <th className="py-1.5 text-left font-medium">Loom</th>
                <th className="py-1.5 text-left font-medium">Board</th>
                <th className="py-1.5 text-left font-medium">Heard from</th>
                <th className="py-1.5 text-right font-medium">Run total</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {active.map((d) => (
                <tr key={d.id}>
                  <td className="py-1.5 font-medium">{d.machine.ID ?? "—"}</td>
                  <td className="py-1.5 text-ink-600">{d.name || d.keyId}{d.firmware && <span className="block text-xs text-ink-400">{d.firmware}</span>}</td>
                  <td className="py-1.5">
                    <StatusChip tone={d.live ? "success" : "neutral"}>{d.live ? "live" : "quiet"}</StatusChip>{" "}
                    <span className="text-xs text-ink-400">{ago(d.lastSeenAt)}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{d.lastReading ? `${Math.floor(d.lastReading.runSecondsTotal / 3600).toLocaleString("en-IN")} h` : "—"}</td>
                  <td className="py-1.5 text-right">
                    <span className="inline-flex gap-1">
                      {/* A new key retires the old one at once, and removing a board
                          stops its readings: both ask in place first. */}
                      <InlineConfirm aria-label={`New key for ${d.machine.ID}`} loading={rekey.isPending && rekey.variables === d.id}
                        question={`Retire ${d.machine.ID ?? "this loom"}'s key? The board stops reporting until the new one is in it.`}
                        confirmLabel="Make a new key" onConfirm={() => rekey.mutate(d.id)}>
                        <KeyRound className="h-4 w-4" aria-hidden /> New key…
                      </InlineConfirm>
                      <InlineConfirm aria-label={`Remove the sensor on ${d.machine.ID}`} title="Remove sensor" danger
                        question={`Remove the sensor on ${d.machine.ID ?? "this loom"}?`}
                        confirmLabel="Remove sensor" onConfirm={() => remove.mutate(d.id)}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </InlineConfirm>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!shown} onClose={() => setShown(null)} title={`The key for ${shown?.loom ?? "the loom"}`} width="max-w-md">
        <p className="text-sm text-ink-600">Copy it into the board's secrets.h now — it is not shown again. A new key can be made at any time; it retires this one.</p>
        <code className="mt-3 block break-all rounded-lg bg-ink-100 p-3 font-mono text-sm" data-testid="device-key">{shown?.key}</code>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(shown?.key ?? "").then(() => toast("Copied", "success"), () => undefined); }}><Copy className="h-4 w-4" aria-hidden /> Copy</Button>
          <Button onClick={() => setShown(null)}>Done</Button>
        </div>
      </Modal>
    </Card>
  );
}
