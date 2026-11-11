import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryCache, QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Home, LogOut, Package, Receipt, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabStrip, type StripTab } from "@/components/ui/TabStrip";
import { ToastProvider } from "@/components/ui/Toast";
import { useIsPhone } from "@/core/hooks/useMediaQuery";
import { portal, PortalError } from "./api";
import { HomePage } from "./pages/HomePage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderPage } from "./pages/OrderPage";
import { DispatchesPage } from "./pages/DispatchesPage";
import { DispatchPage } from "./pages/DispatchPage";
import { CertificatesPage } from "./pages/CertificatesPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { StatementPage } from "./pages/StatementPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// ══════════════════════════════════════════════════════════════════
//  THE CUSTOMER PORTAL  (portal.baluelastics.com)
//
//  A customer signs in with the email and password the office gave
//  them, and reads their own orders, dispatches, certificates, and
//  (unless their login only views) their invoices and statement.
//  Nothing here changes anything.
// ══════════════════════════════════════════════════════════════════

export const ME = ["portal", "me"] as const;

export function makePortalClient() {
  const client: QueryClient = new QueryClient({
    defaultOptions: { queries: { retry: (n, e) => !(e instanceof PortalError && e.status > 0 && e.status < 500) && n < 2, staleTime: 30_000 } },
    // A session that ended (signed out elsewhere, password changed, login
    // switched off) shows the sign-in page, wherever the customer was.
    queryCache: new QueryCache({
      onError: (e, q) => {
        if (e instanceof PortalError && e.status === 401 && q.queryKey[1] !== "me") void client.invalidateQueries({ queryKey: ME });
      },
    }),
  });
  return client;
}

export function PortalApp({ client = makePortalClient() }: { client?: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export function Gate() {
  const me = useQuery({ queryKey: ME, queryFn: portal.me, retry: false, staleTime: 5 * 60_000 });
  if (me.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (me.isError) {
    const err = me.error;
    if (err instanceof PortalError && err.status === 401) return <SignIn />;
    return <CannotReach message={(err as Error).message} onRetry={() => void me.refetch()} />;
  }
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderPage />} />
        <Route path="/orders/:id/certificates" element={<CertificatesPage of="order" />} />
        <Route path="/dispatches" element={<DispatchesPage />} />
        <Route path="/dispatches/:id" element={<DispatchPage />} />
        <Route path="/dispatches/:id/certificates" element={<CertificatesPage of="dispatch" />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/statement" element={<StatementPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Shell>
  );
}

function CannotReach({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <h1 className="font-semibold text-ink-900">The portal is not answering</h1>
        <p className="mt-2 text-sm text-ink-500">{message}</p>
        <Button className="mt-4" onClick={onRetry}>Try again</Button>
      </Card>
    </main>
  );
}

export function SignIn() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useMutation({
    mutationFn: () => portal.signIn(email.trim(), password),
    onSuccess: async () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[1] !== "me" });
      await qc.invalidateQueries({ queryKey: ME });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim() && password) signIn.mutate();
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-brand-600">Customer portal</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">Your orders, dispatches and invoices</h1>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4" aria-label="Sign in">
            <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {signIn.isError && (
              <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
                {(signIn.error as Error).message}
              </p>
            )}
            <Button type="submit" className="w-full" loading={signIn.isPending}>Sign in</Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-ink-500">
          No login, or forgotten the password? Ask the person who handles your orders at the mill for one.
        </p>
      </div>
    </main>
  );
}

const TABS: (StripTab<string> & { money?: boolean; path: string })[] = [
  { id: "home", label: "Home", icon: Home, path: "/" },
  { id: "orders", label: "Orders", icon: Package, path: "/orders" },
  { id: "dispatches", label: "Dispatches", icon: Truck, path: "/dispatches" },
  { id: "invoices", label: "Invoices", icon: Receipt, path: "/invoices", money: true },
  { id: "statement", label: "Statement", icon: FileText, path: "/statement", money: true },
];

function Shell({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const me = useQuery({ queryKey: ME, queryFn: portal.me, retry: false, staleTime: 5 * 60_000 });
  const summary = useQuery({ queryKey: ["portal", "summary"], queryFn: portal.summary });
  const canSeeMoney = me.data?.user.role !== "viewer";
  const phone = useIsPhone();
  const tabs = useMemo(
    () => TABS.filter((t) => !t.money || canSeeMoney).map((t) => (phone ? { ...t, icon: undefined } : t)),
    [canSeeMoney, phone],
  );
  const active = [...tabs].reverse().find((t) => (t.path === "/" ? pathname === "/" : pathname.startsWith(t.path)))?.id ?? "home";
  const signOut = useMutation({
    mutationFn: portal.signOut,
    onSettled: async () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[1] !== "me" });
      await qc.invalidateQueries({ queryKey: ME });
      navigate("/");
    },
  });
  const company = summary.data?.company;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-ink-200/70 bg-surface print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white" aria-hidden>
              {(company?.name || "B").slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">{company?.name || "Customer portal"}</p>
              <p className="truncate text-xs text-ink-500">{me.data?.customer?.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-right text-xs text-ink-500 sm:block">
              <span className="block font-medium text-ink-700">{me.data?.user.name}</span>
              {me.data?.user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={() => signOut.mutate()} loading={signOut.isPending}>
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-2 sm:px-4">
          <TabStrip
            label="Portal"
            tabs={tabs}
            active={active}
            onSelect={(id) => navigate(tabs.find((t) => t.id === id)!.path)}
            className="border-b-0"
          />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">{children}</main>
      {company && (company.phone || company.email) && (
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-ink-500 sm:px-6 print:hidden">
          Questions about an order? {company.phone && <>Call {company.phone}</>}
          {company.phone && company.email && " or "}
          {company.email && <>write to <a className="text-brand-600 underline underline-offset-2 hover:decoration-2" href={`mailto:${company.email}`}>{company.email}</a></>}.
        </footer>
      )}
    </div>
  );
}
