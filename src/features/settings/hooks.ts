import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "./api";
import { DocumentSettingsInput } from "./types";

const KEY = "document-settings";

export function useDocumentSettings() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => settingsService.getDocument(),
    staleTime: 60_000,
  });
}

export function useUpdateDocumentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DocumentSettingsInput) => settingsService.updateDocument(body),
    onSuccess: (settings) => qc.setQueryData([KEY], settings),
  });
}
