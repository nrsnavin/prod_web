import { httpClient } from "@/core/http/httpClient";
import { DocumentSettings, DocumentSettingsInput } from "./types";

export const settingsService = {
  async getDocument(): Promise<DocumentSettings> {
    const res = await httpClient.get<{ success: boolean; settings: DocumentSettings }>(
      "/settings/document"
    );
    return res.settings;
  },

  async updateDocument(body: DocumentSettingsInput): Promise<DocumentSettings> {
    const res = await httpClient.put<{ success: boolean; settings: DocumentSettings }>(
      "/settings/document",
      body
    );
    return res.settings;
  },
};
