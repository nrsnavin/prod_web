import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pdfTemplateService } from "./api";
import { PdfTemplate } from "./types";

export function useDocTypes() {
  return useQuery({
    queryKey: ["pdf-doc-types"],
    queryFn: () => pdfTemplateService.docTypes(),
    staleTime: 5 * 60_000,
  });
}

export function usePdfTemplate(docType: string | undefined) {
  return useQuery({
    queryKey: ["pdf-template", docType],
    queryFn: () => pdfTemplateService.get(docType!),
    enabled: !!docType,
  });
}

export function useSavePdfTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docType, template }: { docType: string; template: PdfTemplate }) =>
      pdfTemplateService.save(docType, template),
    onSuccess: (template) => qc.setQueryData(["pdf-template", template.docType], template),
  });
}
