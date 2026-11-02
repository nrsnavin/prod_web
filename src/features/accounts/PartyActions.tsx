import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileDown, MessageCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { accountsService } from "./api";
import { VoucherForm } from "./VouchersTab";
import { ShareDialog } from "./Share";

/**
 * The money buttons on a customer's or supplier's own page: take a
 * receipt / pay everything due, the statement of account as a PDF, and
 * the statement on WhatsApp.
 */
export function PartyActions({ partyType, party, name }: { partyType: "customer" | "supplier"; party: string; name: string }) {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [sharing, setSharing] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setPaying(true)}><Wallet className="h-4 w-4" /> {partyType === "customer" ? "Record receipt" : "Pay all due"}</Button>
      <a href={accountsService.statementPdfUrl(partyType, party)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"><FileDown className="h-4 w-4" /> Statement</a>
      <Button variant="secondary" onClick={() => setSharing(true)}><MessageCircle className="h-4 w-4" /> Send statement</Button>
      <FormScreen open={paying} onClose={() => setPaying(false)} title={partyType === "customer" ? `Receipt from ${name}` : `Pay ${name}`} width="max-w-4xl">
        {paying && (
          <VoucherForm kind={partyType === "customer" ? "receipt" : "payment"} initialParty={{ id: party, name }} initialDocs={partyType === "supplier" ? "all" : []}
            onDone={(id) => { setPaying(false); navigate(`/accounts/payments/${id}`); }} onCancel={() => setPaying(false)} />
        )}
      </FormScreen>
      {sharing && <ShareDialog what={{ kind: "statement", partyType, party }} customer={partyType === "customer" ? party : undefined} onClose={() => setSharing(false)} />}
    </>
  );
}
