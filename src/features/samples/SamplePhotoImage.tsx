import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useSamplePhotoBlob } from "./hooks";

// One sample photo.
//
// The bytes are fetched through the authenticated XHR path and shown from
// an object URL, rather than pointed at with <img src={apiUrl}>: the API
// sends Cross-Origin-Resource-Policy: same-origin, which is precisely a
// rule against another origin embedding its responses, so the request
// succeeds and the browser paints nothing. See sampleService.photoBlob.
//
// The URL is created from the cached blob and revoked when this img goes
// away — an object URL that is never revoked pins its blob in memory for
// the life of the tab, which for a gallery of 5 MB phone photos adds up.

export function SamplePhotoImage({
  photoId,
  alt,
  className,
}: {
  photoId: string;
  alt: string;
  className?: string;
}) {
  const { data: blob, isLoading, isError } = useSamplePhotoBlob(photoId);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [blob]);

  if (isError) {
    return (
      <div
        role="img"
        aria-label={`${alt} — could not be loaded`}
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-ink-100 p-2 text-center text-ink-400",
          className
        )}
      >
        <ImageOff className="h-5 w-5" />
        <span className="text-[11px]">Could not load</span>
      </div>
    );
  }

  if (isLoading || !url) {
    return (
      <div
        className={cn("flex items-center justify-center bg-ink-100 text-ink-300", className)}
        aria-busy="true"
        aria-label={`Loading ${alt}`}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} />;
}
