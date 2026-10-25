import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useElastic, useElasticMutations } from "@/features/elastics/hooks";
import { ElasticForm } from "@/features/elastics/ElasticForm";

// ══════════════════════════════════════════════════════════════════
//  CORRECTING AN ELASTIC'S RECIPE FROM THE MRP SHEET
//
//  The sheet is where a wrong grammage shows — a yarn short that should
//  not be, a material that should not be there. This opens the same
//  edit form as the elastic page, and saving re-reads the sheet, so the
//  requirement is worked out again from the corrected recipe.
//
//  The version is the one the form opened with, so a save from a form
//  someone else changed meanwhile is refused rather than overwriting.
// ══════════════════════════════════════════════════════════════════

export function MrpElasticEdit({ elasticId, onClose, onSaved }: {
  elasticId: string;
  onClose: () => void;
  /** After the save: the sheet is re-read. */
  onSaved: (name: string) => void;
}) {
  const { data: elastic, isLoading, isError, error } = useElastic(elasticId);
  const { update } = useElasticMutations();
  const { toast } = useToast();
  const [version, setVersion] = useState<number | undefined>(undefined);
  // The version the form opened with, captured once: the elastic query
  // polls, and a later version would let a stale form overwrite.
  const loadedVersion = elastic?.__v;
  useEffect(() => {
    if (loadedVersion !== undefined) setVersion((v) => (v === undefined ? loadedVersion : v));
  }, [loadedVersion]);

  return (
    <FormScreen open onClose={onClose} title={elastic ? `Edit ${elastic.name}` : "Edit elastic"} width="max-w-2xl">
      {isLoading && <Skeleton className="h-96 w-full" />}
      {isError && (
        <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          {error instanceof ApiError ? error.message : "The elastic could not be loaded."}
        </p>
      )}
      {elastic && (
        <>
          <p className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-500">
            Saving recalculates its cost and updates this MRP sheet.
            <Link to={`/elastics/${elasticId}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
              Open the elastic <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </p>
          <ElasticForm
            initial={elastic}
            submitting={update.isPending}
            onCancel={onClose}
            onSubmit={(values) =>
              update.mutate(
                { id: elasticId, body: values, expectedVersion: version },
                {
                  onSuccess: (saved) => {
                    if (saved.costingWarning) toast(saved.costingWarning, "error");
                    onSaved(saved.name ?? elastic.name);
                  },
                  onError: (e) => toast(e instanceof ApiError ? e.message : "Update failed", "error"),
                }
              )
            }
          />
        </>
      )}
    </FormScreen>
  );
}
