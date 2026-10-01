import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/components/ui/ErrorState";
import { employeeService } from "./api";

/**
 * The masked Aadhaar number ("XXXX XXXX 1234"), with Show for an admin.
 * Showing it asks the server, which records who looked; the number is
 * held only while this page is open and is hidden again on Hide.
 */
export function AadhaarValue({ empId, masked, canReveal }: { empId: string; masked?: string; canReveal: boolean }) {
  const { toast } = useToast();
  const [full, setFull] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const none = !masked || masked === "Not Provided";

  // Another employee: never carry one person's number onto the next page.
  useEffect(() => setFull(null), [empId]);

  if (none) return <span className="text-ink-400">Not provided</span>;

  const show = async () => {
    setLoading(true);
    try {
      setFull(await employeeService.revealAadhaar(empId));
    } catch (e) {
      toast(errorMessage(e, "the Aadhaar number"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="tabular-nums">{full ?? masked}</span>
      {canReveal && (
        <button
          type="button"
          onClick={full ? () => setFull(null) : show}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:text-ink-300"
          title={full ? undefined : "Shows the full number. Each view is recorded in the audit trail."}
        >
          {full ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
          {full ? "Hide" : loading ? "Showing…" : "Show"}
        </button>
      )}
    </span>
  );
}
