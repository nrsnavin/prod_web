import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { config } from "@/app/config";
import { ioService } from "./api";

export function DataIoPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // multer upload — raw fetch keeps the multipart body intact.
      const res = await fetch(`${config.apiBaseUrl}/io/import`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Import failed");
      }
      setResult(json.message ?? "Import completed");
      toast("Import completed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <PageHeader
        title="Data import / export"
        subtitle="Bulk raw-material and elastic data via Excel."
      />

      <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
        <Card className="p-6">
          <FileSpreadsheet className="h-8 w-8 text-status-success" />
          <h3 className="mt-3 font-semibold">Export current data</h3>
          <p className="mt-1 text-sm text-ink-400">
            Download the full dataset as an Excel workbook.
          </p>
          <a href={ioService.exportUrl} className="inline-block mt-4">
            <Button variant="secondary">
              <Download className="h-4 w-4" /> Download export
            </Button>
          </a>
        </Card>

        <Card className="p-6">
          <Upload className="h-8 w-8 text-status-info" />
          <h3 className="mt-3 font-semibold">Import from Excel</h3>
          <p className="mt-1 text-sm text-ink-400">
            Fill the template, then upload it to bulk-create records.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={ioService.templateUrl}>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" /> Template
              </Button>
            </a>
            <Button loading={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Upload file
            </Button>
            <input
              aria-label="Choose a spreadsheet to import"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </div>
          {result && <p className="mt-3 text-sm text-status-success">{result}</p>}
        </Card>
      </div>
    </>
  );
}
