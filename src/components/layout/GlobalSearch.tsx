import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { allNavItems } from "@/app/navigation";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";

export interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

// Stage 1: searches navigation destinations. Later stages plug entity
// search (orders, customers, jobs…) into the same surface.
export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNavItems;
    return allNavItems.filter((item) =>
      item.label.toLowerCase().includes(q)
    );
  }, [query]);

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
    <Modal open={open} onClose={onClose} width="max-w-xl">
      <div onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b border-ink-100 pb-3 mb-2">
          <Search className="h-5 w-5 text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a page…"
            className="flex-1 outline-none text-sm placeholder:text-ink-400"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto -mx-2">
          {results.map(({ label, path, icon: Icon }, i) => (
            <li key={path}>
              <button
                onClick={() => go(path)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                  i === active ? "bg-brand-50 text-brand-600" : "text-ink-600"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                {i === active && <CornerDownLeft className="h-4 w-4 opacity-60" />}
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
