import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom doesn't implement scrollIntoView, which some components (e.g. the
// Combobox active-option scroll) call in effects.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom implements neither half of the object-URL API, which anything that
// opens a fetched blob needs (service-bill viewer, report downloads).
if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:test";
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

afterEach(() => cleanup());
