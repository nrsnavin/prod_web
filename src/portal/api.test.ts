import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_API, PORTAL_API, pdfUrl, resolvePortalApi } from "./api";

// The portal is served from its own host and the API from another, so a
// built portal must call the API host by its full address: a relative
// path would reach the portal's own host instead.

describe("where the portal sends requests", () => {
  it("a build: the API host's full address", () => {
    expect(resolvePortalApi({ PROD: true })).toBe("https://api.baluelastics.com/api/v3/portal");
    expect(DEFAULT_PORTAL_API).toMatch(/^https:\/\//);
  });

  it("the dev server: the path it forwards", () => {
    expect(resolvePortalApi({ PROD: false })).toBe("/api/v3/portal");
  });

  it("an address set at build time comes first", () => {
    expect(resolvePortalApi({ PROD: true, VITE_PORTAL_API_BASE: "https://api.example.com/api/v3/portal" })).toBe(
      "https://api.example.com/api/v3/portal",
    );
  });
});

describe("a PDF link", () => {
  it("is the API address and the path, with only the values given", () => {
    expect(pdfUrl("/statement/pdf", { from: "2026-04-01", to: undefined })).toBe(`${PORTAL_API}/statement/pdf?from=2026-04-01`);
    expect(pdfUrl("/dispatches/d1/pdf")).toBe(`${PORTAL_API}/dispatches/d1/pdf`);
  });
});
