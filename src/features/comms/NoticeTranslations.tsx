import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  A notice in the workers' languages: what the employee app shows in
//  Tamil and Hindi. Drafted by the model when posted; correct it here
//  and the correction is kept as yours.
// ══════════════════════════════════════════════════════════════════

export type NoticeTranslation = { title: string; body: string; by?: "ai" | "person" };
export type NoticeTranslationsMap = Partial<Record<"ta" | "hi", NoticeTranslation>>;
const LANGS = { ta: "Tamil", hi: "Hindi" } as const;

export function NoticeTranslations({ id, translations }: { id: string; translations?: NoticeTranslationsMap }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<"ta" | "hi" | null>(null);
  const [form, setForm] = useState<NoticeTranslation>({ title: "", body: "" });
  const done = () => qc.invalidateQueries({ queryKey: ["announcements"] });
  const save = useMutation({
    mutationFn: () => httpClient.put(`/announcement/${id}`, { translations: { [editing!]: form } }),
    onSuccess: () => { toast("Saved", "success"); setEditing(null); done(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Not saved", "error"),
  });
  const again = useMutation({
    mutationFn: () => httpClient.post<{ translated: boolean }>(`/announcement/${id}/translate`, {}),
    onSuccess: (r) => { toast(r.translated ? "Translated" : "Translation is not set up on this server", r.translated ? "success" : "info"); done(); },
  });

  return (
    <div className="mt-2 rounded-lg bg-ink-50 p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-ink-500"><Languages className="h-3.5 w-3.5" /> On the employee app</span>
        <Button size="sm" variant="ghost" loading={again.isPending} onClick={() => again.mutate()}>Translate again</Button>
      </div>
      {(Object.keys(LANGS) as ("ta" | "hi")[]).map((k) => {
        const t = translations?.[k];
        if (editing === k) {
          return (
            <div key={k} className="mt-1 space-y-1">
              <Input label={`${LANGS[k]} title`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              <Input label={`${LANGS[k]} text`} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" loading={save.isPending} disabled={!form.title.trim() || !form.body.trim()} onClick={() => save.mutate()}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          );
        }
        return (
          <div key={k} className="mt-1 flex items-start justify-between gap-2">
            <p className="min-w-0">
              <span className="text-xs text-ink-400">{LANGS[k]}{t?.by === "person" ? " (corrected)" : ""}: </span>
              {t?.title ? <><strong>{t.title}</strong> — {t.body}</> : <span className="text-ink-400">not translated — shown in English</span>}
            </p>
            <button className="shrink-0 text-xs text-brand-600 hover:underline" onClick={() => { setForm({ title: t?.title ?? "", body: t?.body ?? "" }); setEditing(k); }}>{t?.title ? "Correct" : "Write it"}</button>
          </div>
        );
      })}
    </div>
  );
}
