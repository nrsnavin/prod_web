import { useRef, useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Sparkles, Wrench, Loader2, Bot, User } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import { assistantService, ChatMessage } from "./api";

const SUGGESTIONS = [
  "Which orders are at risk this week?",
  "What's driving wastage this month?",
  "What raw materials should I reorder?",
  "What's the status of order 219?",
];

const TOOL_LABELS: Record<string, string> = {
  get_orders_at_risk: "orders at risk",
  get_wastage_summary: "wastage",
  get_materials_to_reorder: "reorder list",
  find_order: "order lookup",
  find_material: "material lookup",
  get_machine_status: "machine status",
};

interface DisplayMessage extends ChatMessage {
  tools?: string[];
}

export function AssistantPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useMutation({
    mutationFn: (msgs: ChatMessage[]) => assistantService.chat(msgs),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || chat.isPending) return;
    const history: ChatMessage[] = [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: q }];
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    chat.mutate(history, {
      onSuccess: (res) =>
        setMessages((m) => [...m, { role: "assistant", content: res.reply, tools: res.toolsUsed }]),
      onError: (e) =>
        setMessages((m) => [
          ...m,
          { role: "assistant", content: e instanceof ApiError ? `⚠️ ${e.message}` : "⚠️ Something went wrong." },
        ]),
    });
  };

  return (
    <>
      <PageHeader
        title="Ask Jarvis"
        subtitle="A read-only assistant that answers from your live orders, production, wastage and stock."
      />

      <Card className="flex h-[calc(100vh-13rem)] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && !chat.isPending && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-500">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="mt-3 font-medium">Ask about the floor</p>
              <p className="mt-1 max-w-sm text-sm text-ink-400">
                Jarvis reads your live data to answer — it can explain and recommend, but never changes anything.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:border-brand-500 hover:text-brand-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-500">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-900")}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.tools && m.tools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-ink-200/60 pt-2">
                    {m.tools.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded bg-surface/70 px-1.5 py-0.5 text-xs text-ink-500">
                        <Wrench className="h-3 w-3" /> {TOOL_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-200 text-ink-600">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {chat.isPending && (
            <div className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-500">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-ink-100 px-4 py-2.5 text-sm text-ink-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking the data…
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 border-t border-ink-100 p-3"
        >
          <input
            aria-label="Ask a question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about orders, wastage, stock, machines…"
            className="h-10 flex-1 rounded-lg border border-ink-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="submit"
            disabled={!input.trim() || chat.isPending}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-500 text-white hover:opacity-90 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </Card>
    </>
  );
}
