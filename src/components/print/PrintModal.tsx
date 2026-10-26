import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

// Shared print-preview surface: whatever is rendered inside becomes the
// only thing on paper (.print-area rules in index.css). One per screen.
//
// Rendered straight under <body>, marked data-print-page="sheet", so that
// when printing everything else leaves the layout (index.css). Hidden
// with visibility alone, the app behind the dialog kept its height and
// pushed the sheet down: a blank first page, the sheet starting half way
// down the second.
export function PrintModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <div data-print-page="sheet">
    <Modal open onClose={onClose} title={title} width="max-w-2xl">
      <div className="print-area max-h-[65vh] overflow-y-auto print:max-h-none print:overflow-visible">
        {children}
      </div>
      <div className="mt-4 flex justify-end gap-2 print:hidden">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
    </Modal>
    </div>,
    document.body
  );
}
