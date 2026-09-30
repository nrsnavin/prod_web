import { Download, RefreshCw, WifiOff } from "lucide-react";
import { usePwaStore, isStandalone } from "@/pwa/pwaStore";
import { cn } from "@/components/ui/cn";

// ══════════════════════════════════════════════════════════════════
//  THREE THINGS THE APP KNOWS THAT THE USER SHOULD
//
//  Offline, a new version waiting, and "this can be installed". They
//  live in the top bar because it is the one thing on every screen that
//  is always visible — a banner at the bottom would sit under the error
//  toasts, which are exactly what appears when the network drops.
//
//  Each is a labelled pill on a wide screen and an icon with the same
//  label as its accessible name on a phone, where the bar has no room.
// ══════════════════════════════════════════════════════════════════

const pill =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

export function AppStatus({ reload = () => window.location.reload() }: { reload?: () => void }) {
  const online = usePwaStore((s) => s.online);
  const updateReady = usePwaStore((s) => s.updateReady);
  const applyUpdate = usePwaStore((s) => s.applyUpdate);
  const updatedElsewhere = usePwaStore((s) => s.updatedElsewhere);
  const installEvent = usePwaStore((s) => s.installEvent);
  const set = usePwaStore((s) => s.set);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    // The event is single-use whatever the answer.
    set({ installEvent: null });
  };

  const showUpdate = (updateReady && applyUpdate) || updatedElsewhere;

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      {!online && (
        <span
          className={cn(pill, "bg-status-warningBg text-status-warning")}
          title="No connection. Changes can't be saved until it's back."
        >
          <WifiOff className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Offline</span>
        </span>
      )}

      {showUpdate && (
        <button
          type="button"
          onClick={() => (updatedElsewhere ? reload() : applyUpdate?.())}
          className={cn(pill, "bg-brand-50 text-brand-600 hover:bg-brand-100")}
          title="A new version of Jarvis is ready. Save what you're doing, then reload."
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Update</span>
          <span className="sr-only"> — reload to the new version</span>
        </button>
      )}

      {installEvent && !isStandalone() && (
        <button
          type="button"
          onClick={install}
          className={cn(pill, "text-ink-600 hover:bg-ink-100 hover:text-ink-900")}
          title="Install Jarvis as an app on this device"
        >
          <Download className="h-4 w-4" aria-hidden />
          <span className="sr-only md:not-sr-only">Install app</span>
        </button>
      )}
    </div>
  );
}
