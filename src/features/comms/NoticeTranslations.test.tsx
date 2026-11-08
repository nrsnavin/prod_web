import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { NoticeTranslations } from "./NoticeTranslations";

// What the employee app shows in Tamil and Hindi, and correcting it.

const put = vi.fn().mockResolvedValue({}); const post = vi.fn().mockResolvedValue({ translated: true });
vi.mock("@/core/http/httpClient", () => ({ httpClient: { put: (...a: unknown[]) => put(...a), post: (...a: unknown[]) => post(...a) } }));
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>);

describe("NoticeTranslations", () => {
  it("shows each language, and says when one falls back to English", () => {
    wrap(<NoticeTranslations id="a1" translations={{ ta: { title: "பாதுகாப்பு பயிற்சி", body: "வெள்ளி 4 மணி", by: "ai" } }} />);
    expect(screen.getByText("பாதுகாப்பு பயிற்சி")).toBeInTheDocument();
    expect(screen.getByText(/not translated — shown in English/)).toBeInTheDocument();
  });

  it("saves a correction as the admin's own", async () => {
    wrap(<NoticeTranslations id="a1" translations={{ ta: { title: "பாதுகாப்பு பயிற்சி", body: "வெள்ளி 4 மணி", by: "ai" } }} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Correct" })[0]);
    const title = screen.getByLabelText("Tamil title");
    await userEvent.clear(title); await userEvent.type(title, "பாதுகாப்பு ஒத்திகை");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(put).toHaveBeenCalledWith("/announcement/a1", { translations: { ta: { title: "பாதுகாப்பு ஒத்திகை", body: "வெள்ளி 4 மணி" } } });
  });

  it("translates again on asking", async () => {
    wrap(<NoticeTranslations id="a1" />);
    await userEvent.click(screen.getByRole("button", { name: /translate again/i }));
    expect(post).toHaveBeenCalledWith("/announcement/a1/translate", {});
  });
});
