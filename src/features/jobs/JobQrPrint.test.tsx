import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JobQrPrint, jobUrl, LABEL_PAGE_CSS, QR_PX, QR_QUIET_MODULES } from "./JobQrPrint";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A 2" × 2" LABEL, AND NOTHING ELSE ON IT
//
//  This was an A4 job card. A4 does not go on a beam or a trolley; a
//  2in square label does, and on 2in there is room for the code and the
//  number a person reads when the code will not scan. Everything the
//  card used to carry is one scan away.
//
//  Three properties carry it, and the third is the one that costs
//  money when it breaks:
//
//    • The QR resolves to something. It encodes the job's own page on
//      the host the sheet was printed from, so a plain phone camera
//      opens it — no scanner app, nothing to configure.
//
//    • The job number is printed in words. A smudge, a flat battery or
//      a camera that will not focus must not make the label useless.
//
//    • ONE label comes out of the printer. The app's print rules hide
//      the rest of the screen with `visibility: hidden`, which leaves
//      it taking up space. On A4 that is a leading blank page nobody
//      notices; at 2in a page it is a stack of blank labels. The sheet
//      is portalled to <body> so a `display: none` rule has a top-level
//      branch to bite on, and that arrangement is pinned here — it is
//      exactly the kind of thing that silently comes undone.
// ══════════════════════════════════════════════════════════════════

// QRCode.toDataURL touches canvas, which jsdom has no real
// implementation of. The QR's CONTENT is what matters here and it is
// asserted through the alt text, so the encoder itself is stubbed.
vi.mock("qrcode", () => ({
  default: { toDataURL: (v: string) => Promise.resolve(`data:image/png;base64,${btoa(v)}`) },
}));

const job = (over: Partial<JobDetail> = {}): JobDetail => ({
  id: "job-abc123",
  jobOrderNo: 42,
  jobNo: "JOB-42",
  date: "2026-08-10T00:00:00Z",
  status: "weaving",
  customerName: "Anand Garments",
  orderNo: 77,
  machine: {
    machineId: "m1", machineName: "LOOM-07",
    machineNoOfHead: 4, manufacturer: "Comez", status: "running",
  },
  plannedElastics: [{ elasticName: "20mm White", quantity: 1200 }],
  producedElastics: [{ elasticName: "20mm White", quantity: 800 }],
  packedElastics: [{ elasticName: "20mm White", quantity: 500 }],
  wastageElastics: [],
  warping: { status: "completed" },
  covering: { status: "pending" },
  shiftDetails: [],
  wastages: [],
  ...over,
} as JobDetail);

const show = (j: JobDetail = job()) =>
  render(<JobQrPrint job={j} open onClose={() => {}} />);

/** The label itself — the 2in square that lands on the stock. */
const label = () => document.querySelector(".print-label-2in") as HTMLElement;

describe("jobUrl", () => {
  it("points at the job page on the host the sheet is printed from", () => {
    // Baked-in hosts are how somebody scanning in the mill gets sent to
    // a machine they cannot reach.
    expect(jobUrl("abc")).toBe(`${window.location.origin}/jobs/abc`);
  });
});

describe("the job label", () => {
  it("encodes the job's own page in the QR", async () => {
    show();
    const img = await screen.findByRole("img", { name: /^QR:/ });
    expect(img).toHaveAttribute(
      "alt",
      `QR: ${window.location.origin}/jobs/job-abc123`
    );
  });

  it("prints the job number, so a bad scan is not a dead end", () => {
    show();
    expect(screen.getByText("JOB-42")).toBeInTheDocument();
  });

  it("wears the class that carries its metrics", () => {
    // The size is not on the element — see the stylesheet block below
    // for why. All the element does is claim the class.
    show();
    expect(label()).toBeTruthy();
  });

  it("sets the page box to match the label", () => {
    // An A4 page box with a 2in label on it is one label per sheet of
    // A4 — and the app's default @page is A4, so this must override it.
    show();
    expect(LABEL_PAGE_CSS).toMatch(/@page\s*\{[^}]*size:\s*2in\s+2in/);
    expect(LABEL_PAGE_CSS).toMatch(/margin:\s*0/);
    expect(document.querySelector("style")?.textContent).toBe(LABEL_PAGE_CSS);
  });

  it("takes the page rule away again when it closes", () => {
    // It is document-level: left behind, it would print the NEXT
    // document — an MRP sheet, a DC — onto 2in squares.
    const { unmount } = show();
    expect(document.body.textContent).toContain("@page");
    unmount();
    expect(document.body.textContent).not.toContain("@page");
  });

  it("fits inside 2in with the number underneath", () => {
    // 2in is 192px at the CSS inch, less 0.1in of padding a side. The
    // code plus the gap plus the line of text has to sit inside that,
    // or the label clips the very thing it exists to carry.
    const content = 192 - 2 * 9.6;
    const textPx = 13 * (96 / 72); // 13pt
    expect(QR_PX + 0.07 * 96 + textPx).toBeLessThan(content);
  });

  it("encodes the quiet zone rather than borrowing it from the padding", () => {
    // The spec's four clear modules are a MODULE count, not a distance,
    // and a module shrinks as the host name grows — so a padding that
    // clears four modules on one deployment clears fewer on another.
    // Left to CSS this fails as "the scanner won't read it", which
    // nobody traces back to a stylesheet.
    expect(QR_QUIET_MODULES).toBe(4);

    const source = readFileSync(
      join(process.cwd(), "src/components/print/QrImg.tsx"), "utf8"
    );
    expect(source).toMatch(/QRCode\.toDataURL\(\s*value,\s*\{\s*margin\s*,/);
  });

  it("carries nothing but the code and the number", () => {
    // Everything the old A4 card printed — customer, machine, the
    // planned/produced/packed table — is one scan away. On 2in it is
    // the difference between a legible label and a grey block.
    show();
    expect(label().textContent).toBe("JOB-42");
    expect(screen.queryByText("Anand Garments")).not.toBeInTheDocument();
    expect(screen.queryByText(/LOOM-07/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("hangs off <body>, not off the page it was opened from", () => {
    // The print rule that stops a stack of blank labels needs a direct
    // child of <body>. Buried inside #root there is nothing for it to
    // hide without hiding the label too.
    show();
    const branch = document.querySelector('[data-print-page="label-2in"]');
    expect(branch?.parentElement).toBe(document.body);
  });

  it("renders nothing until it is opened", () => {
    render(<JobQrPrint job={job()} open={false} onClose={() => {}} />);
    expect(screen.queryByText("JOB-42")).not.toBeInTheDocument();
    expect(document.querySelector('[data-print-page="label-2in"]')).toBeNull();
  });
});

describe("the print stylesheet behind it", () => {
  const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

  it("takes the rest of the app out of the layout, not merely out of sight", () => {
    // `visibility: hidden` — what every other sheet here relies on —
    // still occupies space. At 2in a page that is a blank label for
    // every 2in of app screen behind the dialog.
    expect(css).toMatch(
      /body:has\(\[data-print-page="label-2in"\]\)\s*>\s*\*:not\(\[data-print-page="label-2in"\]\)[\s\S]{0,80}display:\s*none/
    );
  });

  it("keeps every metric of the label in plain CSS, not in a utility class", () => {
    // This is not stylistic. `h-[2in]` and `w-[2in]` compiled; the
    // `p-[0.1in]` and `gap-[0.07in]` written alongside them did NOT —
    // Tailwind's extractor dropped both and reported nothing. The label
    // came out the right size with the QR flush against the paper edge
    // and no quiet zone, which is a code that readers refuse.
    //
    // A plain rule cannot be dropped that way, and this is the check
    // that it stays a plain rule.
    const rule = css.match(/\.print-label-2in\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/width:\s*2in/);
    expect(rule).toMatch(/height:\s*2in/);
    expect(rule).toMatch(/padding:\s*0\.1in/);
    expect(rule).toMatch(/gap:\s*0\.07in/);
    expect(rule).toMatch(/box-sizing:\s*border-box/);
  });

  it("stops the dialog panel's width reaching the paper", () => {
    // `.print-area` is width:100% of a max-w-2xl panel, which is wider
    // than the page.
    expect(css).toMatch(
      /\[data-print-page="label-2in"\]\s*\.print-area[\s\S]{0,80}width:\s*2in/
    );
  });
});
