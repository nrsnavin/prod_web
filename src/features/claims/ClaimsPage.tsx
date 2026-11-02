import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useRequestId } from "@/core/hooks/useRequestId";
import { money } from "@/features/invoices/gst";
import { claimsService, type Claim, type ClaimStatus } from "./api";

const TONE: Record<ClaimStatus, ChipTone> = { pending: "warning", approved: "info", rejected: "danger", paid: "success", cancelled: "neutral" };
const LABEL: Record<ClaimStatus, string> = { pending: "Waiting for approval", approved: "Approved, to be paid", rejected: "Rejected", paid: "Paid back", cancelled: "Withdrawn" };
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Money you spent for the factory, claimed back from the phone: what it
 * was for, how much, the receipt photographed. Accounts approves it and
 * pays you back; you see where each claim stands.
 */
export function ClaimsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const ids = useRequestId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({ queryKey: ["claims"], queryFn: claimsService.mine });
  const { data: categories } = useQuery({ queryKey: ["claims", "categories"], queryFn: claimsService.categories, staleTime: 300_000 });
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(todayIso());
  const [photo, setPhoto] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const body = { category, description: description.trim(), amount: Number(amount), date };
      const claim = await claimsService.create({ ...body, requestId: ids.for(body) });
      if (photo) await claimsService.photo(claim._id, photo).catch((e) => toast(e instanceof Error ? e.message : "The photo did not attach", "error"));
      return claim;
    },
    onSuccess: (c) => {
      ids.done();
      toast(`${c.expenseNo} sent for approval`, "success");
      setOpen(false); setDescription(""); setAmount(""); setPhoto(null);
      qc.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not send the claim", "error"),
  });
  const withdraw = useMutation({
    mutationFn: (c: Claim) => claimsService.withdraw(c._id),
    onSuccess: () => { toast("Withdrawn", "success"); qc.invalidateQueries({ queryKey: ["claims"] }); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not withdraw", "error"),
  });
  const ready = category && description.trim().length >= 3 && Number(amount) > 0 && date;

  return (
    <>
      <PageHeader title="Expense claims" subtitle="Spent your own money for work? Claim it back here." actions={!open ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New claim</Button> : undefined} />
      {data && (data.waiting > 0 || data.owed > 0) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Card className="p-4"><p className="text-xs uppercase tracking-wide text-ink-400">Waiting for approval</p><p className="text-xl font-bold tabular-nums">₹{money(data.waiting)}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase tracking-wide text-ink-400">Approved, to be paid to you</p><p className="text-xl font-bold tabular-nums">₹{money(data.owed)}</p></Card>
        </div>
      )}
      {open && (
        <Card className="mb-4 space-y-3 p-4">
          <Select label="What was it for? *" value={category} onChange={(e) => setCategory(e.target.value)} options={(categories ?? []).map((c) => ({ value: c._id, label: c.name }))} placeholder="Pick one" />
          <Input label="Details *" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Diesel for the genset, 10 L" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (₹) *" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
            <Input label="Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" aria-label="Receipt photo" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" /> {photo ? photo.name : "Photograph the receipt"}</Button>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!ready} loading={create.isPending} onClick={() => create.mutate()}>Send for approval</Button>
          </div>
        </Card>
      )}
      {isLoading ? <Skeleton className="h-48 w-full" /> : (data?.claims ?? []).length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-400">No claims yet. When you pay for something for work, claim it here with the receipt.</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {(data?.claims ?? []).map((c) => (
              <li key={c._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.description}</p>
                  <p className="text-xs text-ink-400">{c.categoryName} · {formatDate(c.date)} · {c.expenseNo}{c.attachments?.length ? " · receipt attached" : ""}</p>
                  {c.status === "rejected" && c.approval?.note && <p className="text-xs text-status-danger">{c.approval.note}</p>}
                  {c.status === "paid" && c.paidAt && <p className="text-xs text-status-success">Paid on {formatDate(c.paidAt)}</p>}
                </div>
                <span className="tabular-nums font-semibold">₹{money(c.totals.grand)}</span>
                <StatusChip tone={TONE[c.status]}>{LABEL[c.status]}</StatusChip>
                {c.status === "pending" && <Button size="sm" variant="ghost" onClick={() => withdraw.mutate(c)}>Withdraw</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
