import { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

// ══════════════════════════════════════════════════════════════════
//  JUMP TO A SECTION
//
//  On a phone an order is 3,173 px and a machine 3,415 px: four screens
//  of one scroll, and the analysis near the bottom is the part least
//  likely to be seen. A bar of chips under the header, pinned below the
//  top bar, takes you to each section in one tap. Wide screens show
//  more at once and do not get it.
// ══════════════════════════════════════════════════════════════════

export interface SectionLink {
  id: string;
  label: string;
}

const reduceMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SectionNav({ sections }: { sections: SectionLink[] }) {
  return (
    <nav
      aria-label="On this page"
      className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-10 -mx-4 mt-4 border-b border-ink-100 bg-canvas/95 px-4 py-2 backdrop-blur lg:hidden print:hidden"
    >
      <ul className="no-scrollbar flex gap-2 overflow-x-auto">
        {sections.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              onClick={(e) => {
                const el = document.getElementById(s.id);
                if (!el) return;
                // Handled here rather than by the hash, which would put
                // "#jobs" into the router's URL and the back stack.
                e.preventDefault();
                el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
              }}
              className="inline-flex items-center rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-sm font-medium text-ink-600 whitespace-nowrap"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * A section the bar can jump to. The scroll margin clears the pinned top
 * bar and this bar, so the heading lands in view rather than under them.
 */
export function Section({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-[calc(8rem+env(safe-area-inset-top))]", className)}>
      {children}
    </section>
  );
}
