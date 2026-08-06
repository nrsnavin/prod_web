import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SamplePhotoImage } from "./SamplePhotoImage";

// The bug this replaces: the tile pointed <img src> straight at the API.
// The API sends Cross-Origin-Resource-Policy: same-origin (helmet), which
// is a rule against another origin embedding its responses — so in
// production the request succeeded and the browser painted nothing. In
// dev the API is same-origin through the Vite proxy, so it looked fine
// and only broke once deployed, and a test that just asserted "an <img>
// with the right src exists" agreed with it the whole way.
//
// So these assert the two things that actually decide whether a photo
// appears: it is fetched through the authenticated XHR path, and what is
// rendered is a blob URL rather than an API URL.

const { getBlob } = vi.hoisted(() => ({ getBlob: vi.fn() }));
vi.mock("@/core/http/httpClient", () => ({
  httpClient: { getBlob },
  ApiError: class ApiError extends Error {},
}));

const blob = () => new Blob(["not-really-png"], { type: "image/png" });

function renderImage(photoId = "p1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SamplePhotoImage photoId={photoId} alt="Trial off loom 4" className="x" />
    </QueryClientProvider>
  );
}

let created: string[] = [];
let revoked: string[] = [];

beforeEach(() => {
  getBlob.mockReset();
  created = [];
  revoked = [];
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn((b: Blob) => {
      const u = `blob:mock/${created.length}`;
      created.push(u);
      void b;
      return u;
    }),
    revokeObjectURL: vi.fn((u: string) => revoked.push(u)),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("a sample photo", () => {
  it("fetches the bytes through the API client, not as a bare image URL", async () => {
    getBlob.mockResolvedValue(blob());
    renderImage("abc123");

    await waitFor(() => expect(getBlob).toHaveBeenCalledWith("/sample/photo/abc123/file"));

    const img = await screen.findByAltText("Trial off loom 4");
    // What is rendered is a blob URL — never a URL on the API host, which
    // is the thing the browser refuses to paint.
    expect(img.getAttribute("src")).toMatch(/^blob:/);
    expect(img.getAttribute("src")).not.toMatch(/\/api\/v2\//);
  });

  it("shows it is loading rather than an empty box", () => {
    getBlob.mockReturnValue(new Promise(() => {}));
    renderImage();
    expect(screen.getByLabelText(/loading trial off loom 4/i)).toBeInTheDocument();
  });

  it("says so when the photo cannot be loaded", async () => {
    getBlob.mockRejectedValue(new Error("410 gone"));
    renderImage();
    // The hook retries once before giving up, so this is deliberately
    // past react-query's 1s first backoff.
    expect(await screen.findByLabelText(/could not be loaded/i, {}, { timeout: 5000 }))
      .toBeInTheDocument();
  });

  // An object URL that is never revoked pins its blob for the life of the
  // tab — for a gallery of 5 MB phone photos that adds up fast.
  it("revokes the object URL when the tile goes away", async () => {
    getBlob.mockResolvedValue(blob());
    const { unmount } = renderImage();
    await screen.findByAltText("Trial off loom 4");
    expect(created).toHaveLength(1);

    unmount();
    expect(revoked).toEqual(created);
  });
});
