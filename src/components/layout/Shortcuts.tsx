import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { canAccessPath } from "@/app/navigation";
import { useAuth } from "@/core/auth/useAuth";

// ══════════════════════════════════════════════════════════════════
//  KEYS FOR PEOPLE WHO LIVE IN THE APP
//
//  ⌘K (Ctrl K) or / opens search, which also starts work ("new order").
//  G then a letter goes straight to a page. ? lists every key, so none
//  of them has to be remembered from a manual. Keys never fire while
//  someone is typing in a field or a dialog is open.
// ══════════════════════════════════════════════════════════════════

/** G then the letter: the pages people move between all day. */
export const GO_TO: Array<{ key: string; label: string; path: string }> = [
  { key: "d", label: "Dashboard", path: "/" },
  { key: "o", label: "Orders", path: "/orders" },
  { key: "j", label: "Job orders", path: "/jobs" },
  { key: "c", label: "Delivery challans", path: "/delivery-challans" },
  { key: "i", label: "Invoices", path: "/invoices" },
  { key: "a", label: "Accounts", path: "/accounts" },
  { key: "s", label: "Shift verification", path: "/shift-verification" },
  { key: "m", label: "Machines", path: "/machines" },
  { key: "r", label: "Raw materials", path: "/materials" },
  { key: "u", label: "Customers", path: "/customers" },
  { key: "p", label: "Payroll", path: "/payroll" },
];

/** Whether a key press belongs to whatever has focus, not to the app. */
function typingOrBusy(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return true;
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]');
}

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * The app's keys. `openSearch` toggles search; ⌘K works from inside a
 * field as well (it is never typed text), the others only outside one.
 */
export function useShortcuts({ toggleSearch, openSearch, openHelp }: { toggleSearch: () => void; openSearch: () => void; openHelp: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleSearch();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || typingOrBusy(e)) return;
      if (pendingG.current != null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const to = GO_TO.find((g) => g.key === e.key.toLowerCase());
        if (to && !user?.selfService && canAccessPath(to.path, user)) {
          e.preventDefault();
          navigate(to.path);
        }
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        openSearch();
      } else if (e.key === "?") {
        e.preventDefault();
        openHelp();
      } else if (e.key.toLowerCase() === "g" && !e.shiftKey) {
        // The second key has a moment to follow, as on GitHub or Gmail.
        pendingG.current = window.setTimeout(() => { pendingG.current = null; }, 1500);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (pendingG.current != null) window.clearTimeout(pendingG.current);
    };
  }, [toggleSearch, openSearch, openHelp, navigate, user]);
}

function Keys({ children }: { children: ReactNode }) {
  return <span className="inline-flex shrink-0 items-center gap-1">{children}</span>;
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-sans text-xs font-medium text-ink-700 shadow-[inset_0_-1px_0_rgb(var(--color-ink-200)/1)]">
      {children}
    </kbd>
  );
}

function Row({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 py-1.5 text-sm text-ink-700">
      <span>{children}</span>
      {keys}
    </li>
  );
}

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const mod = isMac() ? "⌘" : "Ctrl";
  const goTo = user?.selfService ? [] : GO_TO.filter((g) => canAccessPath(g.path, user));
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" width="max-w-lg" confirmDirtyClose={false}>
      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-label="Anywhere">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Anywhere</h3>
          <ul>
            <Row keys={<Keys><Key>{mod}</Key><Key>K</Key></Keys>}>Search or start something</Row>
            <Row keys={<Keys><Key>/</Key></Keys>}>Search</Row>
            <Row keys={<Keys><Key>?</Key></Keys>}>This list</Row>
            <Row keys={<Keys><Key>Esc</Key></Keys>}>Close a dialog or menu</Row>
          </ul>
          <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-ink-400">In search</h3>
          <ul>
            <Row keys={<Keys><Key>↑</Key><Key>↓</Key></Keys>}>Move</Row>
            <Row keys={<Keys><Key>Enter</Key></Keys>}>Open</Row>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Search takes “new order”, “receipt from Sunrise”, “pay Lakshmi Yarns”, “J-4”, “#4” or “go to invoices”.
          </p>
        </section>
        {goTo.length > 0 && (
          <section aria-label="Go to">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Go to</h3>
            <ul>
              {goTo.map((g) => (
                <Row key={g.key} keys={<Keys><Key>G</Key><Key>{g.key.toUpperCase()}</Key></Keys>}>{g.label}</Row>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
