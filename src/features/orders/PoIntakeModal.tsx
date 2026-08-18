import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileUp, Loader2, AlertTriangle, CheckCircle2, Ban, ChevronDown,
} from "lucide-react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { cn } from "@/components/ui/cn";
import { orderService } from "./api";
import type { PoIntakeResult, PoIntakeLine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A CUSTOMER'S PO, READ AND HANDED OVER FOR CHECKING
//
//  Stage → verify → apply. This screen shows what was read; the person
//  fixes what is wrong and carries it into the order form. Nothing is
//  created here.
//
//  ── What the design is fighting ──────────────────────────────────
//  A filled-in form invites a confirm. The more complete it looks, the
//  less it gets read — which is exactly backwards, because this is the
//  one OCR surface reading a document nobody here designed.
//
//  So: an unmatched line is loud rather than blank, a preselected match
//  still shows what else it could have been, and a product withheld
//  because its width disagrees says so by name. Somebody who cannot see
//  why "25mm" is missing will assume the master lacks it and create a
//  duplicate product.
// ══════════════════════════════════════════════════════════════════

function LineRow({ line, index }: { line: PoIntakeLine; index: number }) {
  const [open, setOpen] = useState(false);
  const m = line.match;

  return (
    <li className={cn(
      "rounded-lg border p-3",
      m.confident ? "border-ink-100" : "border-status-warning/40 bg-status-warningBg/20"
    )}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-400">Line {index + 1}</span>
            {m.confident ? (
              <StatusChip tone="success">matched</StatusChip>
            ) : (
              <StatusChip tone="warning">needs a pick</StatusChip>
            )}
          </div>
          {/* What the document says, verbatim. The thing to check
              against, so it is never replaced by the match. */}
          <p className="mt-1 font-medium">{line.description}</p>
          <p className="mt-0.5 text-sm text-ink-500 tabular-nums">
            {line.quantity != null ? `${line.quantity.toLocaleString("en-IN")} ${line.unit ?? "m"}` : (
              <span className="text-status-warning">no quantity read</span>
            )}
            {" · "}
            {line.rate != null ? `₹${line.rate}` : (
              <span className="text-status-warning">no rate read</span>
            )}
          </p>
        </div>

        <div className="text-right text-sm">
          {m.confident ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              {m.elasticName}
            </span>
          ) : (
            <span className="text-status-warning">
              {m.candidates.length > 0 ? "Pick one below" : "No product matched"}
            </span>
          )}
        </div>
      </div>

      {(m.candidates.length > 0 || m.blockedByWidth.length > 0) && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-900"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            {m.confident ? "Other possibilities" : "Choose a product"}
            <span className="font-normal text-ink-400">({m.candidates.length})</span>
          </button>

          {open && (
            <div className="mt-2 space-y-1">
              {m.candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md bg-surface-2 px-2.5 py-1.5 text-sm">
                  <span>{c.name}</span>
                  <span className="tabular-nums text-xs text-ink-400">{Math.round(c.score * 100)}% similar</span>
                </div>
              ))}

              {/* Named, not silently withheld. Without this somebody
                  concludes the master is missing the product. */}
              {m.blockedByWidth.map((b) => (
                <div key={b.name} className="flex items-start gap-2 rounded-md bg-status-dangerBg/30 px-2.5 py-1.5 text-xs text-status-danger">
                  <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span><strong>{b.name}</strong> — not offered. {b.reason}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function Result({ result }: { result: PoIntakeResult }) {
  const d = result.draft!;
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Customer</p>
            {d.customer.confident ? (
              <p className="mt-0.5 font-medium">{d.customer.customerName}</p>
            ) : (
              <p className="mt-0.5 text-status-warning">
                {d.customerName ? `"${d.customerName}" — no match, pick one` : "Not read"}
              </p>
            )}
            {!d.customer.confident && d.customer.candidates.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-sm text-ink-500">
                {d.customer.candidates.map((c) => (
                  <li key={c.id}>{c.name} <span className="text-xs text-ink-400">({Math.round(c.score * 100)}%)</span></li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Their PO no.</p>
              <p className="mt-0.5 font-medium">{d.poNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Wanted by</p>
              <p className="mt-0.5 font-medium">{d.deliveryDate ?? "—"}</p>
            </div>
          </div>
        </div>
      </Card>

      {result.summary.needsAttention > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-status-warningBg/50 px-3 py-2 text-sm text-status-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {result.summary.needsAttention} of {result.summary.lines} line
            {result.summary.lines === 1 ? "" : "s"} could not be matched confidently.
            Widths in particular — a near-identical name is a different product.
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {d.lines.map((l, i) => <LineRow key={i} line={l} index={i} />)}
      </ul>

      <p className="text-xs text-ink-400">{result.disclaimer}</p>
    </div>
  );
}

export function PoIntakeModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<PoIntakeResult | null>(null);

  const intake = useMutation({
    mutationFn: (file: File) => orderService.intakePo(file),
    onSuccess: (res) => {
      if (res.available === false) { toast(res.message || "Intake is not configured", "info"); return; }
      if (!res.ok) { toast(res.message || "Couldn't read that document", "info"); return; }
      setResult(res);
      toast(
        res.summary.needsAttention === 0
          ? "Read — check it before saving"
          : `Read — ${res.summary.needsAttention} line(s) need a pick`,
        res.summary.needsAttention === 0 ? "success" : "info"
      );
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't read that document", "error"),
  });

  return (
    <FormScreen open onClose={onClose} title="Read a customer PO" width="max-w-3xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-ink-200 p-6 text-center">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setResult(null); intake.mutate(f); }
            }}
          />
          <FileUp className="mx-auto h-8 w-8 text-ink-300" />
          <p className="mt-2 text-sm text-ink-500">
            A photo or PDF of the customer's purchase order.
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => fileRef.current?.click()}
            disabled={intake.isPending}
          >
            {intake.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {result ? "Read another" : "Choose a file"}
          </Button>
          <p className="mt-3 text-xs text-ink-400">
            Nothing is created from this. It fills in a draft for you to check.
          </p>
        </div>

        {result && <Result result={result} />}
      </div>
    </FormScreen>
  );
}

export default PoIntakeModal;
