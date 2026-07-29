import { RotateCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// Failure banner with a working recovery path: retry re-runs every
// active query on the page instead of forcing a full reload.
export function ErrorBanner({ message }: { message: string }) {
  const qc = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
      <span className="flex-1">{message}</span>
      <button
        onClick={async () => {
          setRetrying(true);
          await qc.refetchQueries({ type: "active" });
          setRetrying(false);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-status-danger/40 px-2.5 py-1 font-medium hover:bg-status-dangerSolid hover:text-white transition-colors"
      >
        <RotateCw className={retrying ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        Retry
      </button>
    </div>
  );
}
