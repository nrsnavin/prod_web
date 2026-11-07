import { create } from "zustand";
import type { ComboOption } from "@/components/ui/Combobox";

// The "+ Add …" request a picker makes, kept apart from the forms that
// answer it (./QuickCreate.tsx, loaded only when first asked), so every
// screen with a picker does not carry every master's form.

export type QuickKind = "customer" | "supplier" | "material" | "elastic" | "employee" | "expenseHead" | "bankAccount";

/** What each is called in a picker's "+ Add a new …". */
export const QUICK_LABEL: Record<QuickKind, string> = {
  customer: "customer", supplier: "supplier", material: "material", elastic: "elastic",
  employee: "employee", expenseHead: "expense head", bankAccount: "account",
};

interface Ask { kind: QuickKind; name: string; resolve: (o: ComboOption | null) => void }
export const useQuick = create<{ ask: Ask | null; set: (a: Ask | null) => void }>((set) => ({ ask: null, set: (ask) => set({ ask }) }));

/** Open the form for a new `kind`, starting from `name`; resolves with the new option, or null. */
export function quickCreate(kind: QuickKind, name = ""): Promise<ComboOption | null> {
  return new Promise((resolve) => {
    // One at a time: a second ask closes the first as cancelled.
    useQuick.getState().ask?.resolve(null);
    useQuick.getState().set({ kind, name: name.trim(), resolve });
  });
}

/** The props a picker spreads to offer "+ Add a new …" for `kind`. */
export const addable = (kind: QuickKind) => ({ onCreate: (typed: string) => quickCreate(kind, typed), createLabel: QUICK_LABEL[kind] });

