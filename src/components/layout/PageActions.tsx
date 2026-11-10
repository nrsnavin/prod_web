import { ReactNode, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useMediaQuery } from "@/core/hooks/useMediaQuery";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";

// ══════════════════════════════════════════════════════════════════
//  ONE OBVIOUS NEXT STEP
//
//  Record pages showed seven to nine buttons of equal weight, so the
//  thing to do next looked like everything else. A page now says one
//  primary action (the next step for the record as it stands), a couple
//  of secondary ones, and puts the rest under More.
//
//  On a phone the primary action also sits in a bar above the bottom
//  navigation, where a thumb reaches it, instead of somewhere up in a
//  wrapped row of buttons.
// ══════════════════════════════════════════════════════════════════

export interface PageAction {
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
}

export function PageActions({
  primary,
  secondary = [],
  more = [],
}: {
  primary?: PageAction | null;
  secondary?: Array<PageAction | null | false | undefined>;
  more?: Array<ActionMenuItem | null | false | undefined>;
}) {
  const sec = secondary.filter(Boolean) as PageAction[];
  const items = more.filter(Boolean) as ActionMenuItem[];
  // While the phone bar shows, the page's foot makes room for it
  // (AppShell adds --phone-bar to its bottom padding).
  // Below lg (where the bottom navigation shows) the primary action moves
  // to the bar; one or the other is rendered, never both.
  const narrow = useMediaQuery("(max-width: 1023px)");
  const hasBar = !!primary && narrow;
  useEffect(() => {
    if (!hasBar) return;
    document.documentElement.style.setProperty("--phone-bar", "4.5rem");
    return () => { document.documentElement.style.removeProperty("--phone-bar"); };
  }, [hasBar]);
  return (
    <>
      {sec.map((a, i) => (
        <Button key={i} variant="secondary" onClick={a.onClick} loading={a.loading} disabled={a.disabled} title={a.title}>
          {a.icon}
          {a.label}
        </Button>
      ))}
      {items.length > 0 && (
        <ActionMenu label="More" icon={<MoreHorizontal className="h-4 w-4" />} items={items} align="right" size="md" />
      )}
      {primary && !hasBar && (
        <Button onClick={primary.onClick} loading={primary.loading} disabled={primary.disabled} title={primary.title}>
          {primary.icon}
          {primary.label}
        </Button>
      )}
      {primary && hasBar && (
        // Phones and tablets: the same action, pinned above the bottom navigation.
        <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 border-t border-ink-200 bg-surface/95 p-3 backdrop-blur">
          <Button className="w-full" onClick={primary.onClick} loading={primary.loading} disabled={primary.disabled} title={primary.title}>
            {primary.icon}
            {primary.label}
          </Button>
        </div>
      )}
    </>
  );
}
