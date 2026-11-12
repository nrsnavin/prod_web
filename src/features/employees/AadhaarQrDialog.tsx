import { useRef, useState } from "react";
import { ImageUp, RotateCcw, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { QrScanner, ScannerWords } from "@/features/floor/QrScanner";
import { qrFromPhoto } from "@/features/floor/photoQr";
import { employeeService } from "./api";
import { AadhaarQrMatches, AadhaarQrResult, AadhaarSignature, NameMatch } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE AADHAAR CARD'S QR CODE: READ IT, AND SEE WHETHER UIDAI SIGNED IT
//
//  The holder agrees first: offline verification is theirs to allow.
//  Then the camera reads the large QR code on the letter, the e-Aadhaar
//  or the PVC card, or a photo of it is chosen. The server reads the
//  code and checks UIDAI's signature (utils/aadhaarQr.js on the server).
//  What comes back is shown as it is: signed, not matching, not checked,
//  or the old unsigned code. It is never dressed up as more than that.
//
//  With an employee named, the outcome is kept on their record. On the
//  new-employee form nothing is kept yet: the form fills from the card,
//  and the code goes with the record when it is saved.
// ══════════════════════════════════════════════════════════════════

const WORDS: ScannerWords = {
  hint: "Hold the card's large QR code inside the frame",
  ariaLabel: "Camera, pointed at the Aadhaar card's QR code",
  insecure: "The camera only works when the page is opened over https://. Open the secure address, or choose a photo of the QR code below.",
  noCamera: "This browser has no camera access. Choose a photo of the QR code below.",
  denied: "Camera access was refused. Allow it in the browser's site settings, or choose a photo of the QR code below.",
  failed: "The camera could not be started. Choose a photo of the QR code below.",
};

/** What a signature state means, in plain words. */
export function signatureWords(signature: AadhaarSignature): { tone: ChipTone; title: string; detail: string } {
  switch (signature) {
    case "valid":
      return { tone: "success", title: "Signed by UIDAI", detail: "These are the details UIDAI issued. The code has not been changed." };
    case "invalid":
      return { tone: "danger", title: "UIDAI's signature does not match", detail: "This code has been changed, or UIDAI did not issue it. Do not rely on these details: ask for the card again." };
    case "unchecked":
      return { tone: "warning", title: "Signature not checked", detail: "UIDAI's certificates are not on the server yet, so these details are unproven. On the server, run: node scripts/fetch-uidai-certs.js" };
    case "unsigned":
      return { tone: "warning", title: "Old QR code: nothing to check", detail: "Cards printed before 2019 have a QR code without UIDAI's signature. It can fill the form, but it proves nothing. A fresh e-Aadhaar download or the mAadhaar app has a code that can be checked." };
  }
}

const NAME_WORDS: Record<NameMatch, string> = {
  same: "Name matches",
  close: "Name is close (initials or a word differ)",
  different: "Name does not match",
};

/** The comparisons that could be made, as lines with a tone. */
export function matchLines(m: AadhaarQrMatches, { onRecord }: { onRecord: boolean }): Array<{ ok: boolean; text: string }> {
  const lines: Array<{ ok: boolean; text: string }> = [];
  if (m.last4 !== null) lines.push({ ok: m.last4, text: m.last4 ? `Last 4 digits match the Aadhaar number ${onRecord ? "on record" : "typed"}` : `Last 4 digits do not match the Aadhaar number ${onRecord ? "on record" : "typed"}` });
  if (m.name !== null) lines.push({ ok: m.name !== "different", text: NAME_WORDS[m.name] });
  if (m.phone !== null) lines.push({ ok: m.phone, text: m.phone ? "Phone matches the mobile registered with Aadhaar" : "Phone is not the mobile registered with Aadhaar" });
  return lines;
}

const dmy = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "");
const GENDER_WORDS = { male: "Male", female: "Female", other: "Transgender / other" } as const;

export function AadhaarQrDialog({ open, onClose, personName, employeeId, compare, onFill, fillLabel = "Fill the form", onChecked }: {
  open: boolean;
  onClose: () => void;
  /** Who is being checked, for the consent line. */
  personName?: string;
  /** Keep the outcome on this employee. */
  employeeId?: string;
  /** What the form holds, to compare the card with when there is no employee yet. */
  compare?: { name?: string; phoneNumber?: string; aadhar?: string };
  /** Use the card's details; given the result and the code's text. */
  onFill?: (result: AadhaarQrResult, qr: string) => void;
  fillLabel?: string;
  /** Told after every check, e.g. to refresh the record it was kept on. */
  onChecked?: (result: AadhaarQrResult) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ data: AadhaarQrResult; qr: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setResult(null);
    setError("");
    setConsent(false);
    onClose();
  };

  const check = async (qr: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await employeeService.checkAadhaarQr({ qr, consent: true, ...(employeeId ? { employeeId } : { compare }) });
      setResult({ data, qr });
      onChecked?.(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The code could not be checked. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBusy(true);
    const qr = await qrFromPhoto(file, [2400, 1600, 1000]);
    setBusy(false);
    if (!qr) {
      setError("No QR code was found in that photo. Take it straight on, close enough that the QR code fills most of the picture.");
      return;
    }
    await check(qr);
  };

  const who = personName?.trim() || "The employee";

  return (
    <Modal open={open} onClose={close} title="Check the Aadhaar QR code" confirmDirtyClose={false}>
      {!result ? (
        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-lg border border-ink-100 bg-canvas/50 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              <span className="font-medium">{who} agrees to this check of their Aadhaar QR code.</span>
              <span className="mt-1 block text-xs text-ink-500">
                The code is read and UIDAI's signature on it is checked. {employeeId ? "The outcome is kept on their record, with your name; " : "Only the outcome is kept, with the record; "}
                the photo on the card is not.
              </span>
            </span>
          </label>

          {consent && (
            <>
              <QrScanner dense paused={busy} words={WORDS} onCode={(code) => void check(code)} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <ImageUp className="h-4 w-4" aria-hidden /> Choose a photo of the QR code
                </Button>
                {busy && <span className="text-sm text-ink-500" role="status">Checking…</span>}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Photo of the Aadhaar QR code"
                onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ""; }}
              />
            </>
          )}
          {error && <p className="rounded-lg bg-status-dangerBg p-3 text-sm text-status-danger" role="alert">{error}</p>}
        </div>
      ) : (
        <ResultView
          data={result.data}
          onRecord={!!employeeId}
          // Never offered for a code whose signature fails: its details are not the card's.
          onFill={onFill && result.data.read.fields && result.data.read.signature !== "invalid" ? () => { onFill(result.data, result.qr); close(); } : undefined}
          fillLabel={fillLabel}
          onAgain={() => { setResult(null); setError(""); }}
          onDone={close}
        />
      )}
    </Modal>
  );
}

function ResultView({ data, onRecord, onFill, fillLabel, onAgain, onDone }: {
  data: AadhaarQrResult;
  onRecord: boolean;
  onFill?: () => void;
  fillLabel: string;
  onAgain: () => void;
  onDone: () => void;
}) {
  const { read, matches } = data;
  const s = signatureWords(read.signature);
  const Icon = read.signature === "valid" ? ShieldCheck : read.signature === "invalid" ? ShieldAlert : ShieldQuestion;
  const f = read.fields;
  const rows: Array<[string, string]> = f
    ? ([
        ["Name", f.name],
        ["Date of birth", dmy(f.dob)],
        ["Gender", f.gender ? GENDER_WORDS[f.gender] : ""],
        ["Care of", f.careOf],
        ["Address", f.address],
        ["Pin code", f.pincode],
      ] as Array<[string, string]>)
    : [];
  if (read.aadhaar) rows.push(["Aadhaar number", read.aadhaar.replace(/(\d{4})(?=\d)/g, "$1 ")]);
  else if (read.last4) rows.push(["Aadhaar number", `ends in ${read.last4}`]);
  if (read.mobileLast4) rows.push(["Registered mobile", `ends in ${read.mobileLast4}`]);
  if (read.issuedAt) rows.push(["Code made on", formatDate(read.issuedAt)]);
  // A code whose signature fails has altered details: comparing them proves nothing.
  const untrusted = read.signature === "invalid";
  const lines = untrusted ? [] : matchLines(matches, { onRecord });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-ink-100 p-3" role="status">
        <Icon className="mt-0.5 h-6 w-6 shrink-0 text-ink-500" aria-hidden />
        <div>
          <StatusChip tone={s.tone}>{s.title}</StatusChip>
          <p className="mt-1.5 text-sm text-ink-600">{s.detail}</p>
        </div>
      </div>

      {read.layout === "unreadable" && (
        <p className="text-sm text-ink-600">
          The signature was checked, but this card's QR layout{read.version ? ` (${read.version})` : ""} is not one this version can read field by field. Type the details in.
        </p>
      )}
      {read.layout === "guessed" && (
        <p className="text-xs text-ink-500">A newer QR layout ({read.version}): every field had the shape it should, so it was read. Compare it with the card.</p>
      )}

      {rows.some(([, v]) => v) && (
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {untrusted && <p className="text-xs text-ink-500">No comparison is shown: these details are not the card's.</p>}
      {lines.length > 0 && (
        <ul className="space-y-1 text-sm">
          {lines.map((l) => (
            <li key={l.text} className={l.ok ? "text-status-success" : "text-status-danger"}>{l.ok ? "✓" : "✗"} {l.text}</li>
          ))}
        </ul>
      )}

      {data.check && <p className="text-xs text-ink-500">Kept on their record.</p>}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onAgain}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Scan another
        </Button>
        {onFill ? (
          <Button type="button" onClick={onFill}>{fillLabel}</Button>
        ) : (
          <Button type="button" onClick={onDone}>Done</Button>
        )}
      </div>
    </div>
  );
}
