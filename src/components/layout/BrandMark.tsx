/**
 * The J — the same stroke as public/favicon.svg and the installed app's
 * icon, so the tab, the home-screen icon, the login screen and the
 * sidebar are all visibly one product. Drawn in currentColor; the
 * caller supplies the tile.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <path
        d="M20 18 H44 M37 18 V37 C37 45.5 28.5 48.5 22 43.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
