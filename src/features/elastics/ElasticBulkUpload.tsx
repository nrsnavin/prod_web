import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { saveBlob } from "./ElasticBulkActions";
import { BulkUploadResult, elasticService } from "./api";

// ══════════════════════════════════════════════════════════════════
//  ELASTIC PRODUCTS FROM AN EXCEL SHEET
//
//  1. Download the template — it carries the raw materials that exist,
//     so materials are picked from a dropdown, not typed.
//  2. Fill it: one row per elastic, one row per warp yarn.
//  3. Upload it. New names are added, existing ones updated; anything
//     that could not be saved is listed with its row and the reason.
// ══════════════════════════════════════════════════════════════════

export function ElasticBulkUpload({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);

  const download = async (withExample: boolean) => {
    setDownloading(true);
    try {
      saveBlob(await elasticService.bulkTemplate(withExample), "elastic_products_upload.xlsx");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not download the template", "error");
    } finally {
      setDownloading(false);
    }
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await elasticService.bulkUpload(file);
      setResult(r);
      qc.invalidateQueries({ queryKey: ["elastics"] });
      toast(r.message, r.skipped.length ? "info" : "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Bulk upload elastic products" width="max-w-xl">
      <div className="space-y-5 text-sm">
        <section className="space-y-2">
          <p className="font-medium">1. Download the Excel template</p>
          <p className="text-ink-500">
            One row per elastic on <b>Elastics</b>, one row per warp yarn on <b>ElasticWarpYarns</b>.
            Materials are picked from a dropdown of the raw materials already in the app — add a
            new one under Raw Materials first. Every column is explained on the Instructions sheet.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={downloading} onClick={() => download(false)}>
              <Download className="h-4 w-4" /> Template
            </Button>
            <Button variant="ghost" size="sm" disabled={downloading} onClick={() => download(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Template with an example row
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <p className="font-medium">2. Upload the filled sheet</p>
          <p className="text-ink-500">
            A name already in the app updates that elastic; blank cells keep what it has. New elastics
            need spandex ends, pick, hooks and weight. Each is costed as it goes in.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Filled workbook"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4" /> {file ? "Choose another" : "Choose file"}
            </Button>
            {file && <span className="truncate text-ink-600">{file.name}</span>}
            <Button size="sm" loading={uploading} disabled={!file} onClick={upload}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </div>
        </section>

        {result && (
          <section aria-label="Upload result" className="space-y-2 rounded-lg border border-ink-100 p-3">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden />
              {result.added} added, {result.updated} updated
            </p>
            {result.skipped.length > 0 && (
              <div>
                <p className="flex items-center gap-2 font-medium text-status-danger">
                  <AlertTriangle className="h-4 w-4" aria-hidden /> {result.skipped.length} not saved — fix and upload again
                </p>
                <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-ink-600">
                  {result.skipped.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            )}
            {result.warnings.length > 0 && (
              <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-status-warning">
                {result.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
          </section>
        )}

        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  );
}
