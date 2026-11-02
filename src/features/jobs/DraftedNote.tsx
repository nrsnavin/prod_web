/**
 * Metres entered on the floor and waiting to be verified, under a
 * verified figure: "+ 2,460 m drafted, to verify". The claim and the
 * checked number sit side by side and are never added together.
 *
 * Renders nothing when there is nothing drafted, so the column reads
 * exactly as before on a job with no pending entries.
 */
export function DraftedNote({ drafted }: { drafted?: number | null }) {
  const m = Number(drafted) || 0;
  if (m <= 0) return null;
  return (
    <span
      className="block text-xs text-status-warning tabular-nums"
      title="Entered on the floor, not verified yet — not counted in the figure above"
    >
      + {m.toLocaleString("en-IN")} m drafted, to verify
    </span>
  );
}
