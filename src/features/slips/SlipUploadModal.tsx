import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useSlipMutations } from "./hooks";
import { Shift, Slip } from "./types";

const MAX_FILES = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

// The web door for the same thing WhatsApp does: photos of a slip, and
// optionally which shift they are (a printed sheet says so itself).
export function SlipUploadModal({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (slip: Slip) => void;
}) {
  const { toast } = useToast();
  const { upload } = useSlipMutations();
  const [files, setFiles] = useState<File[]>([]);
  const [dateKey, setDateKey] = useState("");
  const [shift, setShift] = useState<Shift | "">("");

  useEffect(() => {
    if (open) { setFiles([]); setDateKey(""); setShift(""); }
  }, [open]);

  const tooMany = files.length > MAX_FILES;

  const submit = () => {
    if (!files.length || tooMany) return;
    upload.mutate(
      { files, dateKey: dateKey || undefined, shift },
      {
        onSuccess: (slip) => {
          toast(`Slip ${slip.confirmCode} is being read`, "success");
          onUploaded(slip);
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Upload failed", "error"),
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload a production slip" width="max-w-md">
      <div className="space-y-4">
        <div>
          <label htmlFor="slip-photos" className="mb-1.5 block text-sm font-medium text-ink-600">
            Photos of the slip *
          </label>
          <input
            id="slip-photos"
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          <p className={tooMany ? "mt-1 text-xs text-status-danger" : "mt-1 text-xs text-ink-400"}>
            {tooMany
              ? `At most ${MAX_FILES} photos per slip.`
              : files.length
                ? `${files.length} photo${files.length === 1 ? "" : "s"} chosen. One per page of the slip.`
                : "JPEG, PNG or PDF. One photo per page, flat and in good light."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          <Select
            label="Shift"
            value={shift}
            onChange={(e) => setShift(e.target.value as Shift | "")}
            placeholder="From the slip"
            options={[
              { value: "DAY", label: "Day" },
              { value: "NIGHT", label: "Night" },
            ]}
          />
        </div>
        <p className="text-xs text-ink-400">
          Leave these blank for the app&apos;s printed sheet, or when the slip shows the date and
          shift. If you fill them, they win over what is written.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button type="button" loading={upload.isPending} disabled={!files.length || tooMany} onClick={submit}>
            Read slip
          </Button>
        </div>
      </div>
    </Modal>
  );
}
