import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// ══════════════════════════════════════════════════════════════════
//  "NEW ORDER / GROUP / CHALLAN WITH THESE ELASTICS"
//
//  The elastic list's selection is handed to another page's create form
//  through router state, not the URL: nothing to bookmark or share, and
//  a refresh does not reopen the form. The receiving page opens its
//  form once, pre-filled, and the state is cleared behind it.
// ══════════════════════════════════════════════════════════════════

export interface PrefillElastic {
  _id: string;
  name: string;
}

export interface PrefillState {
  prefillElastics?: PrefillElastic[];
}

/** State to navigate with, e.g. navigate("/orders", { state: prefillState(rows) }). */
export const prefillState = (rows: PrefillElastic[]): PrefillState => ({
  prefillElastics: rows.map((r) => ({ _id: r._id, name: r.name })),
});

/**
 * On a page with a create form: the elastics it was sent with, if any.
 * Calls `open` once when they arrive; `clear` forgets them, so the next
 * plain "New" starts blank.
 */
export function usePrefillElastics(open: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const [prefill, setPrefill] = useState<PrefillElastic[] | null>(null);
  const sent = (location.state as PrefillState | null)?.prefillElastics;

  useEffect(() => {
    if (!sent?.length) return;
    setPrefill(sent);
    open();
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // Once per arrival: `sent` is gone after the replace above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent]);

  return { prefill, clear: () => setPrefill(null) };
}
