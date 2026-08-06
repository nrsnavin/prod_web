import { useCallback, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { customerService } from "@/features/customers/api";
import { useSampleMutations } from "./hooks";

// Raising a sample request. Everything here is written once and then
// never edited — anything that changes afterwards is an entry in the
// log — so the form asks only for what is true at the moment it is
// raised, and leaves the story to the detail page.

export function SampleCreateForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const { create } = useSampleMutations();
  // Server-searched: the customer master is longer than any page cap.
  const loadCustomers = useCallback(
    (q: string) =>
      customerService
        .list({ page: 1, search: q, limit: 50 })
        .then((r) => r.customers.map((c) => ({ value: c._id, label: c.name }))),
    []
  );

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("normal");

  const ready = title.trim().length > 0 && details.trim().length > 0;

  const submit = () =>
    create.mutate(
      {
        title: title.trim(),
        details: details.trim(),
        ...(customerId ? { customerId } : {}),
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(quantity ? { quantity: Number(quantity) } : {}),
        ...(targetDate ? { targetDate } : {}),
        priority: priority as "low" | "normal" | "high",
      },
      {
        onSuccess: (sample) => {
          toast(`Sample S-${sample.sampleNo} raised`, "success");
          onCreated(sample._id);
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Could not raise the sample", "error"),
      }
    );

  return (
    <div className="space-y-4">
      <Input
        label="What is being asked for"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Navy 25mm woven, matt finish"
      />

      <div>
        <label htmlFor="sample-details" className="mb-1.5 block text-sm font-medium text-ink-600">
          The spec, as the customer gave it
        </label>
        <textarea
          id="sample-details"
          rows={4}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Width, shade, composition, elongation, finish — whatever was said. Free text: a sample is a thing that does not fit the product master yet."
          className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AsyncCombobox
          label="Customer"
          placeholder="Not a customer yet"
          loadOptions={loadCustomers}
          value={customerId}
          onChange={setCustomerId}
        />
        {/* A sample is often for somebody who is not in the customer
            master yet — a name is better than nothing. */}
        {!customerId && (
          <Input
            label="…or just a name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Harlow Garments (enquiry)"
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Quantity (m)"
          type="number"
          min={0}
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Optional"
        />
        <Input
          label="Wanted by"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          options={[
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" },
          ]}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!ready} loading={create.isPending} onClick={submit}>
          Raise sample
        </Button>
      </div>
    </div>
  );
}
