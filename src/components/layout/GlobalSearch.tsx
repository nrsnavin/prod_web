import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, CornerDownLeft, FileText, Users, Cable, Boxes, Truck, ShoppingCart, Cog, LucideIcon } from "lucide-react";
import { allNavItems, canAccess } from "@/app/navigation";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";
import { httpClient } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";

export interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

interface Hit {
  icon: LucideIcon;
  label: string;
  sub?: string;
  path: string;
}

// ══════════════════════════════════════════════════════════════════
//  SEARCH IN THE APP'S OWN WORDS
//
//  The app writes a job as "J-3" and an order as "#4" on every screen,
//  and people type what they read. Search used to find a job only from
//  a bare "3", and never looked at orders or machines at all, so "J-3",
//  "#4", a customer PO or "LOOM-04" all came back empty.
// ══════════════════════════════════════════════════════════════════

export interface ParsedQuery {
  /** A job number, from "3", "J-3", "j3", "job 3". */
  jobNo?: number;
  /** An order number, from "4", "#4", "order 4". */
  orderNo?: number;
}

export function parseQuery(q: string): ParsedQuery {
  const s = q.trim();
  const bare = s.match(/^\d+$/);
  if (bare) return { jobNo: Number(s), orderNo: Number(s) };
  const job = s.match(/^(?:j|job)\s*-?\s*#?\s*(\d+)$/i);
  if (job) return { jobNo: Number(job[1]) };
  const order = s.match(/^(?:order\s*)?#\s*(\d+)$/i) || s.match(/^order\s+(\d+)$/i);
  if (order) return { orderNo: Number(order[1]) };
  return {};
}

// Entity lookups reuse the modules' own search endpoints; each source
// fails independently so one bad endpoint never blanks the whole list
// (and a department that may not read orders simply gets none).
async function searchEntities(q: string): Promise<Hit[]> {
  const parsed = parseQuery(q);
  // A job or order number is a lookup, not a phrase: don't also ask the
  // name-search endpoints for "J-3".
  const numeric = parsed.jobNo !== undefined || parsed.orderNo !== undefined;
  const none = Promise.resolve(null);
  const [customers, elastics, dcs, jobs, materials, orders, machines] = await Promise.allSettled([
    numeric
      ? none
      : httpClient.get<{ customers: Array<{ _id: string; name: string; phoneNumber?: string }> }>(
          "/customer/all-customers",
          { search: q, limit: 5, page: 1 }
        ),
    numeric
      ? none
      : httpClient.get<{ elastics: Array<{ _id: string; name: string; weaveType?: string }> }>(
          "/elastic/get-elastics",
          { search: q, limit: 5, page: 1 }
        ),
    httpClient.get<{ dcs: Array<{ _id: string; dcNumber: string; customerName?: string }> }>(
      "/dc/list",
      { search: q, limit: 5, page: 1 }
    ),
    parsed.jobNo !== undefined
      ? httpClient.get<{ jobs: Array<{ _id: string; jobOrderNo: number; customer?: { name?: string } }> }>(
          "/job/jobs",
          { search: String(parsed.jobNo), limit: 5, page: 1 }
        )
      : none,
    numeric
      ? none
      : httpClient.get<{ materials: Array<{ _id: string; name: string; category?: string }> }>(
          "/materials/get-raw-materials",
          { search: q }
        ),
    parsed.jobNo !== undefined && parsed.orderNo === undefined
      ? none
      : httpClient.get<{ orders: Array<{ _id: string; orderNo: number; po?: string; customer?: { name?: string } | null }> }>(
          "/order/list",
          { status: "all", search: parsed.orderNo !== undefined ? String(parsed.orderNo) : q, limit: 5, page: 1 }
        ),
    numeric
      ? none
      : httpClient.get<{ machines: Array<{ _id: string; ID: string; status?: string }> }>("/machine/get-machines"),
  ]);

  const hits: Hit[] = [];
  if (orders.status === "fulfilled" && orders.value) {
    for (const o of (orders.value.orders ?? []).slice(0, 5))
      hits.push({ icon: ShoppingCart, label: `Order #${o.orderNo}`, sub: [o.po, o.customer?.name].filter(Boolean).join(" · ") || "Order", path: `/orders/${o._id}` });
  }
  if (machines.status === "fulfilled" && machines.value) {
    // The list is the whole plant (tens of looms), so it is matched here
    // rather than by a search endpoint that does not exist.
    const needle = q.toLowerCase().replace(/[\s-]/g, "");
    for (const m of (machines.value.machines ?? [])
      .filter((m) => m.ID.toLowerCase().replace(/[\s-]/g, "").includes(needle))
      .slice(0, 5))
      hits.push({ icon: Cog, label: m.ID, sub: m.status ? `Machine · ${m.status}` : "Machine", path: `/machines/${m._id}` });
  }
  if (jobs.status === "fulfilled" && jobs.value) {
    for (const j of jobs.value.jobs ?? [])
      hits.push({ icon: FileText, label: `Job J-${j.jobOrderNo}`, sub: j.customer?.name, path: `/jobs/${j._id}` });
  }
  if (customers.status === "fulfilled" && customers.value) {
    for (const c of (customers.value.customers ?? []).slice(0, 5))
      hits.push({ icon: Users, label: c.name, sub: c.phoneNumber || "Customer", path: `/customers/${c._id}` });
  }
  if (elastics.status === "fulfilled" && elastics.value) {
    for (const e of (elastics.value.elastics ?? []).slice(0, 5))
      hits.push({ icon: Cable, label: e.name, sub: e.weaveType || "Elastic", path: `/elastics/${e._id}` });
  }
  if (materials.status === "fulfilled" && materials.value) {
    for (const m of (materials.value.materials ?? []).slice(0, 5))
      hits.push({ icon: Boxes, label: m.name, sub: m.category || "Material", path: `/materials/${m._id}` });
  }
  if (dcs.status === "fulfilled" && dcs.value) {
    for (const d of (dcs.value.dcs ?? []).slice(0, 5))
      hits.push({ icon: Truck, label: d.dcNumber, sub: d.customerName || "Delivery challan", path: `/delivery-challans/${d._id}` });
  }
  return hits;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  const q = query.trim();
  const entities = useQuery({
    queryKey: ["global-search", q],
    queryFn: () => searchEntities(q),
    enabled: open && q.length >= 2,
    staleTime: 15_000,
  });

  const { user } = useAuth();
  const pageHits: Hit[] = useMemo(() => {
    const needle = q.toLowerCase();
    // Only offer pages this user can actually open — otherwise search
    // surfaces screens that bounce on click.
    const accessible = allNavItems.filter((i) => canAccess(i, user));
    const items = needle
      ? accessible.filter((i) => i.label.toLowerCase().includes(needle))
      : accessible;
    return items.map((i) => ({ icon: i.icon, label: i.label, sub: "Page", path: i.path }));
  }, [q, user]);

  const results: Hit[] = useMemo(
    () => [...(q.length >= 2 ? entities.data ?? [] : []), ...pageHits],
    [entities.data, pageHits, q]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].path);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl" confirmDirtyClose={false}>
      <div onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b border-ink-100 pb-3 mb-2">
          <Search className="h-5 w-5 text-ink-400" />
          <input
            aria-label="Search everything"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="J-3, #4, a PO, a customer, LOOM-04… or a page"
            className="flex-1 outline-none text-sm placeholder:text-ink-400"
          />
          {entities.isFetching && (
            <span className="text-xs text-ink-400 animate-pulse">searching…</span>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto -mx-2">
          {results.map(({ label, sub, path, icon: Icon }, i) => (
            <li key={`${path}-${i}`}>
              <button
                onClick={() => go(path)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                  i === active ? "bg-brand-50 text-brand-600" : "text-ink-600"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {sub && <span className="text-xs text-ink-400 truncate max-w-40">{sub}</span>}
                {i === active && <CornerDownLeft className="h-4 w-4 opacity-60 shrink-0" />}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-ink-400">
              No matches for “{query}”
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
