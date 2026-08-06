import { useRef, useState } from "react";
import { Camera, ImageOff, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { sampleService } from "./api";
import { useSampleMutations } from "./hooks";
import { formatWhen } from "./sampleShared";
import { SampleDetail, SamplePhoto } from "./types";

// The gallery. Half of what a sample file is for cannot be written in
// words — the shade card, the trial off the loom, the customer's own
// swatch held next to ours.
//
// A removed photo keeps its tile. The log said a photo was put here, and
// a gallery that silently loses one would contradict it.

const MAX_MB = 5;

export function SamplePhotos({
  sample,
  canAdd,
}: {
  sample: SampleDetail;
  canAdd: boolean;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { addPhoto, removePhoto } = useSampleMutations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState("");
  const [viewing, setViewing] = useState<SamplePhoto | null>(null);
  const [removing, setRemoving] = useState<SamplePhoto | null>(null);
  const [reason, setReason] = useState("");

  const photos = sample.photos ?? [];

  const onPick = (file: File | undefined) => {
    if (!file) return;
    // Checked here as well as on the server so a 5 MB phone photo fails
    // in a sentence rather than after a slow upload.
    if (file.size > MAX_MB * 1024 * 1024) {
      toast(`That photo is too large — the limit is ${MAX_MB} MB.`, "error");
      return;
    }
    addPhoto.mutate(
      { id: sample._id, file, caption: caption.trim() },
      {
        onSuccess: () => {
          setCaption("");
          if (fileRef.current) fileRef.current.value = "";
          toast("Photo added", "success");
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Could not add the photo", "error"),
      }
    );
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Camera className="h-4 w-4 text-ink-400" />
          Photos
          {photos.length > 0 && (
            <span className="text-sm font-normal text-ink-400">{photos.length}</span>
          )}
        </h3>
      </div>

      {photos.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">
          No photos yet. A shade card or a shot off the loom says more than the note under it.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p._id} className="group relative">
              {p.removed ? (
                <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-200 p-2 text-center">
                  <ImageOff className="h-5 w-5 text-ink-300" />
                  <span className="text-[11px] text-ink-400">Removed</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewing(p)}
                  className="block w-full overflow-hidden rounded-lg border border-ink-200"
                  aria-label={`Open photo${p.caption ? `: ${p.caption}` : ""}`}
                >
                  <img
                    src={sampleService.photoUrl(p._id)}
                    alt={p.caption || "Sample photo"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </button>
              )}
              <p className="mt-1 truncate text-xs text-ink-600">
                {p.removed ? p.removalReason : p.caption || p.filename || "Photo"}
              </p>
              <p className="truncate text-[11px] text-ink-400">
                {p.uploadedByName || "—"} · {formatWhen(p.createdAt)}
              </p>
              {isAdmin && !p.removed && (
                <button
                  type="button"
                  onClick={() => {
                    setRemoving(p);
                    setReason("");
                  }}
                  aria-label={`Remove photo${p.caption ? `: ${p.caption}` : ""}`}
                  className="absolute right-1 top-1 rounded-full bg-surface/90 p-1 text-ink-400 opacity-0 transition-opacity hover:text-status-danger focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              label="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Trial off loom 4, shade slightly light"
            />
            <div>
              <input
                ref={fileRef}
                id="sample-photo-file"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => onPick(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                loading={addPhoto.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-4 w-4" /> Add photo
              </Button>
            </div>
          </div>
          <p className="mt-1 text-xs text-ink-400">
            JPEG, PNG, WebP or HEIC, up to {MAX_MB} MB. Adding a photo writes it into the log.
          </p>
        </div>
      ) : (
        <p className="mt-4 border-t border-ink-100 pt-4 text-sm text-ink-400">
          This sample is {sample.status.replace("_", " ")} — reopen it to add photos.
        </p>
      )}

      {/* Full size, because a shade is not judgeable at thumbnail size. */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.caption || "Photo"}
        width="max-w-3xl"
        confirmDirtyClose={false}
      >
        {viewing && (
          <div>
            <img
              src={sampleService.photoUrl(viewing._id)}
              alt={viewing.caption || "Sample photo"}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
            <p className="mt-2 text-xs text-ink-400">
              {viewing.uploadedByName || "—"} · {formatWhen(viewing.createdAt)}
            </p>
          </div>
        )}
      </Modal>

      {/* Removal is a tombstone, not a delete — so it asks for a reason,
          and the reason is what the log will carry. */}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this photo?"
        width="max-w-md"
      >
        <p className="text-sm text-ink-600">
          The photo comes down but the log keeps the entry that put it here, with your reason
          against it.
        </p>
        <div className="mt-3">
          <Input
            label="Why is it being removed?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Photo of the wrong sample"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3}
            loading={removePhoto.isPending}
            onClick={() =>
              removing &&
              removePhoto.mutate(
                { photoId: removing._id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    setRemoving(null);
                    toast("Photo removed", "success");
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Could not remove the photo", "error"),
                }
              )
            }
          >
            Remove
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
