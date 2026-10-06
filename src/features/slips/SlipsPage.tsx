import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useSlips } from "./hooks";
import { SlipFilter } from "./api";
import { Slip } from "./types";
import { countsSummary, shiftTitle, statusLabel, statusTone } from "./slipText";
import { SlipUploadModal } from "./SlipUploadModal";

// ══════════════════════════════════════════════════════════════════
//  PRODUCTION SLIPS
//
//  Photos of the shift's production record, sent to the factory's
//  WhatsApp number (or uploaded here), read and matched to their shift.
//  The clear ones are saved by replying "OK <number>" on WhatsApp; the
//  ones held for a check are corrected and saved from here. Either way
//  they become submissions, still verified on Shift Verification.
// ══════════════════════════════════════════════════════════════════

function received(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const columns: Column<Slip>[] = [
  { key: "code", header: "Slip", render: (s) => <span className="font-medium tabular-nums">#{s.confirmCode}</span> },
  { key: "shift", header: "Shift", render: (s) => shiftTitle(s) },
  {
    key: "from",
    header: "Sent by",
    render: (s) => (
      <span>
        {s.sentByName || "—"}
        <span className="text-ink-400"> · {s.source === "whatsapp" ? "WhatsApp" : "uploaded"}</span>
      </span>
    ),
  },
  { key: "rows", header: "Looms", render: (s) => <span className="tabular-nums">{countsSummary(s.counts)}</span> },
  {
    key: "status",
    header: "Status",
    render: (s) => <StatusChip tone={statusTone[s.status]}>{statusLabel[s.status]}</StatusChip>,
  },
  { key: "at", header: "Received", render: (s) => <span className="tabular-nums">{received(s.createdAt)}</span> },
];

const FILTERS: { value: SlipFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "applied", label: "Saved" },
  { value: "discarded", label: "Dropped" },
  { value: "all", label: "All" },
];

export function SlipsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SlipFilter>("open");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data, isLoading, isError, error } = useSlips(status, page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Production slips"
        subtitle="Shift production read from a photo, waiting to be confirmed"
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Upload photo
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-600">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <p>
          Send a photo of the slip to the factory WhatsApp number. If the slip doesn&apos;t show
          the date and shift, add a caption like <span className="font-medium">DAY 06-10</span>.
          The reply says what was read; answer <span className="font-medium">OK</span> with the
          slip number to save the clear rows, and check the rest here.
        </p>
      </div>

      <div className="mb-4">
        <FilterChips
          options={FILTERS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data?.slips ?? []}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/production-slips/${s.id}`)}
          loading={isLoading}
          emptyTitle={status === "open" ? "No slips waiting" : "No slips"}
        />
        <Pagination page={page} totalPages={totalPages} total={data?.total} onChange={setPage} />
      </Card>

      <SlipUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(slip) => {
          setUploadOpen(false);
          navigate(`/production-slips/${slip.id}`);
        }}
      />
    </>
  );
}
