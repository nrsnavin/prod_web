import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  WHICH DATABASE AM I WORKING IN
//
//  Some accounts are routed to a sandbox database — a second database
//  on the same cluster, for trying things on real-shaped data without
//  a mistake reaching production (db/tenants.js in the API).
//
//  The design goal is that a sandbox request looks exactly like a live
//  one. That is right for the code and wrong for the person: a screen
//  that behaves identically in both is a screen that cannot tell you
//  which one you are in. The API has answered this since the feature
//  shipped, at GET /session/database. Nothing in this app ever asked.
//
//  The cost of that silence was an afternoon: a machine and a service
//  log that were plainly on screen, and an API insisting they did not
//  exist, because the page and the write were reading different
//  databases and no surface anywhere said so.
//
//  ── Deliberately invisible on production ─────────────────────────
//  Ordinary users see nothing new. The badge appears ONLY when the
//  session is actually routed to a sandbox, so this cannot become
//  another chip everybody learns to ignore — and the live app, which
//  is what most people load, is unchanged.
// ══════════════════════════════════════════════════════════════════

export interface SessionDatabase {
  email?: string;
  /** The database this session's requests read and write. */
  database: string;
  /** True only when routed AWAY from the live database. */
  sandbox: boolean;
  /** Whether sandbox routing is configured on this server at all. */
  configured: boolean;
  /** Set when SANDBOX_DB names the live database — routing is off. */
  warning?: string;
}

export function useSessionDatabase() {
  return useQuery({
    queryKey: ["session", "database"],
    queryFn: () => httpClient.get<SessionDatabase>("/session/database"),
    // It cannot change without a new login, and a failure here must
    // never look like a problem with the page it sits on.
    staleTime: Infinity,
    retry: false,
  });
}

export function SandboxBadge() {
  const { data } = useSessionDatabase();
  if (!data?.sandbox) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-status-warning/40 bg-status-warningBg px-2.5 py-1 text-xs font-semibold text-status-warning"
      // The name of the database, not just the word "sandbox": two
      // sandboxes are possible, and "which one" is the next question.
      title={`Your account works in the "${data.database}" database. Nothing here touches live data.`}
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      Sandbox · {data.database}
    </span>
  );
}

export default SandboxBadge;
