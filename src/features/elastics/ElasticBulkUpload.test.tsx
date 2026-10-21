import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ElasticBulkUpload } from "./ElasticBulkUpload";

// ══════════════════════════════════════════════════════════════════
//  BULK UPLOAD — download the template, upload it, see what went in
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const bulkTemplate = vi.fn();
const bulkUpload = vi.fn();
const saveBlob = vi.fn();

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./api", () => ({
  elasticService: {
    bulkTemplate: (x: boolean) => bulkTemplate(x),
    bulkUpload: (f: File) => bulkUpload(f),
  },
}));
vi.mock("./ElasticBulkActions", () => ({ saveBlob: (...a: unknown[]) => saveBlob(...a) }));

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ElasticBulkUpload onClose={() => {}} />
    </QueryClientProvider>
  );

beforeEach(() => [toast, bulkTemplate, bulkUpload, saveBlob].forEach((f) => f.mockReset()));

it("downloads the template, plain or with an example row", async () => {
  bulkTemplate.mockResolvedValue(new Blob(["x"]));
  const u = userEvent.setup();
  renderIt();
  await u.click(screen.getByRole("button", { name: /^Template$/ }));
  await u.click(screen.getByRole("button", { name: /with an example row/ }));
  expect(bulkTemplate.mock.calls).toEqual([[false], [true]]);
  await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), "elastic_products_upload.xlsx"));
});

it("uploads the chosen file and lists what could not be saved", async () => {
  bulkUpload.mockResolvedValue({
    added: 3, updated: 1, warnings: [], message: "3 added, 1 updated, 1 not saved",
    skipped: ['Elastics row 5 "No Pick": a new elastic needs pick'],
  });
  const u = userEvent.setup();
  renderIt();
  expect(screen.getByRole("button", { name: /Upload/ })).toBeDisabled();
  const file = new File(["xlsx"], "elastics.xlsx");
  await u.upload(screen.getByLabelText("Filled workbook"), file);
  await u.click(screen.getByRole("button", { name: /^Upload$/ }));
  expect(bulkUpload).toHaveBeenCalledWith(file);
  expect(await screen.findByText("3 added, 1 updated")).toBeInTheDocument();
  expect(screen.getByText(/1 not saved — fix and upload again/)).toBeInTheDocument();
  expect(screen.getByText(/row 5 "No Pick": a new elastic needs pick/)).toBeInTheDocument();
});
