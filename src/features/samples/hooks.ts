import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sampleService, SampleListQuery } from "./api";
import { SampleCreateValues, SampleStatus } from "./types";

const KEY = "samples";

export function useSamples(query: SampleListQuery) {
  return useQuery({
    queryKey: [KEY, "list", query],
    queryFn: () => sampleService.list(query),
    placeholderData: (prev) => prev,
  });
}

export function useSample(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => sampleService.detail(id!),
    enabled: !!id,
  });
}

/**
 * The bytes of one photo, cached so a reopened gallery does not re-fetch
 * what it already has. Never garbage-collected while a tile is mounted;
 * the object URL built from it is revoked by the component.
 */
export function useSamplePhotoBlob(photoId: string) {
  return useQuery({
    queryKey: [KEY, "photo", photoId],
    queryFn: () => sampleService.photoBlob(photoId),
    // A photo never changes — it is replaced or tombstoned, never edited.
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function useSampleMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (body: SampleCreateValues) => sampleService.create(body),
    onSuccess: invalidate,
  });

  const addLog = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => sampleService.addLog(id, note),
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: SampleStatus; note: string }) =>
      sampleService.setStatus(id, status, note),
    onSuccess: invalidate,
  });

  const addPhoto = useMutation({
    mutationFn: ({ id, file, caption }: { id: string; file: File; caption: string }) =>
      sampleService.addPhoto(id, file, caption),
    onSuccess: invalidate,
  });

  const removePhoto = useMutation({
    mutationFn: ({ photoId, reason }: { photoId: string; reason: string }) =>
      sampleService.removePhoto(photoId, reason),
    onSuccess: invalidate,
  });

  return { create, addLog, setStatus, addPhoto, removePhoto };
}
