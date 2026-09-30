import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";
import type { OutputBundle, OutputChunk } from "rollup";

// Files in public/ the app needs to open offline and to be installable.
const STATIC_SHELL = [
  "/index.html",
  "/site.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/** Fill the service worker template. Pure, so it can be tested. */
export function renderServiceWorker(
  template: string,
  opts: { buildId: string; precache: string[] }
): string {
  return template
    .replace("__BUILD_ID__", JSON.stringify(opts.buildId))
    .replace("__PRECACHE__", JSON.stringify(opts.precache));
}

/**
 * The entry chunk, the chunks it imports statically, and their CSS — what
 * has to be on the device for the app to boot at all. Route chunks are
 * lazy and cached the first time each screen is opened.
 */
export function entryFiles(bundle: OutputBundle): string[] {
  const out = new Set<string>();
  const visit = (fileName: string) => {
    const item = bundle[fileName];
    if (!item || item.type !== "chunk" || out.has(`/${fileName}`)) return;
    out.add(`/${fileName}`);
    const css = (item as OutputChunk & { viteMetadata?: { importedCss?: Set<string> } })
      .viteMetadata?.importedCss;
    css?.forEach((c) => out.add(`/${c}`));
    item.imports.forEach(visit);
  };
  for (const [fileName, item] of Object.entries(bundle)) {
    if (item.type === "chunk" && item.isEntry) visit(fileName);
  }
  return [...out].sort();
}

/**
 * Writes dist/sw.js from pwa/sw.js on `vite build`. The build id is a
 * hash of every output file name — Vite's names carry content hashes, so
 * any code change gives a new id, and an unchanged rebuild gives the
 * same one (no pointless "new version" prompt).
 */
export function serviceWorkerPlugin(templatePath: string): Plugin {
  return {
    name: "jarvis-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const precache = [...STATIC_SHELL, ...entryFiles(bundle)];
      const buildId = createHash("sha256")
        .update(Object.keys(bundle).sort().join("\n"))
        .digest("hex")
        .slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: renderServiceWorker(readFileSync(templatePath, "utf8"), { buildId, precache }),
      });
    },
  };
}
