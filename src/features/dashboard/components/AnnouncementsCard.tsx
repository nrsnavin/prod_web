import { Link } from "react-router-dom";
import { Megaphone, Pin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Announcement } from "../api";

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function AnnouncementsCard({
  items,
  loading,
}: {
  items?: Announcement[];
  loading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Announcements</h3>
        <Link to="/announcements" className="text-sm font-medium text-brand-600 hover:underline">
          Manage
        </Link>
      </div>

      {loading || !items ? (
        <div className="mt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="No active announcements"
          description="Post one from the Announcements page to reach the floor."
        />
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {items.slice(0, 5).map((a) => (
            <li key={a._id} className="py-2.5">
              <div className="flex items-center gap-2">
                {a.isPinned && <Pin className="h-3.5 w-3.5 text-brand-500 shrink-0" />}
                <p className="truncate text-sm font-medium">{a.title}</p>
                <span className="ml-auto shrink-0 text-xs text-ink-400">
                  {formatDate(a.createdAt)}
                </span>
              </div>
              {a.body && (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-400">{a.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
