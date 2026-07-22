import { httpClient } from "@/core/http/httpClient";
import { DocType, PdfTemplate } from "./types";

export const pdfTemplateService = {
  async docTypes(): Promise<DocType[]> {
    const res = await httpClient.get<{ success: boolean; docTypes: DocType[] }>(
      "/pdf-templates/doc-types"
    );
    return res.docTypes;
  },

  async get(docType: string): Promise<PdfTemplate> {
    const res = await httpClient.get<{ success: boolean; template: PdfTemplate }>(
      `/pdf-templates/${docType}`
    );
    return res.template;
  },

  async save(docType: string, template: PdfTemplate): Promise<PdfTemplate> {
    const res = await httpClient.put<{ success: boolean; template: PdfTemplate }>(
      `/pdf-templates/${docType}`,
      template
    );
    return res.template;
  },

  // Render the (possibly unsaved) draft to a PDF blob for preview.
  preview(docType: string, template: PdfTemplate): Promise<Blob> {
    return httpClient.postBlob(`/pdf-templates/${docType}/preview`, template);
  },
};
