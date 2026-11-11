import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { config } from "@/app/config";
import {
  newPortalPassword,
  portalLoginService,
  PORTAL_ROLES,
  roleLabel,
  type PortalLogin,
  type PortalRole,
} from "./portalLogins";

// ══════════════════════════════════════════════════════════════════
//  WHO AT A CUSTOMER CAN SIGN IN TO THE PORTAL
//
//  The office makes each login; a customer cannot sign up alone. A
//  password is made here and shown once, to be given to the person by
//  phone or WhatsApp. A login can be given a new password (the old one
//  and every session it opened stop working), switched off for a while,
//  or removed.
// ══════════════════════════════════════════════════════════════════

const portalHost = config.portalUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Given {
  login: PortalLogin;
  password: string;
  isNew: boolean;
}

export function PortalLoginsCard({ customerId, customerName }: { customerId: string; customerName: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["customer-portal-users", customerId];
  const q = useQuery({ queryKey: key, queryFn: () => portalLoginService.list(customerId), retry: false });
  const [adding, setAdding] = useState(false);
  const [given, setGiven] = useState<Given | null>(null);
  const [resetFor, setResetFor] = useState<PortalLogin | null>(null);
  const [removeFor, setRemoveFor] = useState<PortalLogin | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown, fallback: string) => toast(e instanceof ApiError ? e.message : fallback, "error");

  const toggle = useMutation({
    mutationFn: (u: PortalLogin) =>
      portalLoginService.update(customerId, u._id, { status: u.status === "active" ? "disabled" : "active" }),
    onSuccess: (r) => {
      toast(r.user.status === "active" ? `${r.user.name} can sign in again` : `${r.user.name} is switched off and signed out`, "success");
      void refresh();
    },
    onError: (e) => fail(e, "Could not change the login"),
  });
  const reset = useMutation({
    mutationFn: async (u: PortalLogin) => {
      const password = newPortalPassword();
      const r = await portalLoginService.update(customerId, u._id, { password });
      return { login: r.user, password };
    },
    onSuccess: ({ login, password }) => {
      setResetFor(null);
      setGiven({ login, password, isNew: false });
      void refresh();
    },
    onError: (e) => fail(e, "Could not set a new password"),
  });
  const remove = useMutation({
    mutationFn: (u: PortalLogin) => portalLoginService.remove(customerId, u._id),
    onSuccess: () => {
      toast("Login removed", "success");
      setRemoveFor(null);
      void refresh();
    },
    onError: (e) => fail(e, "Could not remove the login"),
  });

  const users = q.data ?? [];

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4 text-brand-500" aria-hidden /> Portal logins
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            People at {customerName} who can sign in at <span className="font-medium text-ink-700">{portalHost}</span> to
            follow their orders, dispatches and invoices.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add login
        </Button>
      </div>

      {q.isLoading ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : q.isError ? (
        <p className="mt-3 text-sm text-ink-400">Could not load the portal logins.</p>
      ) : users.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">No one at this customer can sign in yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100" aria-label="Portal logins">
          {users.map((u) => (
            <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                  {u.name}
                  <StatusChip tone="neutral">{roleLabel(u.role)}</StatusChip>
                  {u.status !== "active" && <StatusChip tone="warning">Switched off</StatusChip>}
                </p>
                <p className="text-xs text-ink-500">
                  {u.email}
                  {u.lastLoginAt ? ` · last signed in ${formatDate(u.lastLoginAt)}` : " · has not signed in yet"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => setResetFor(u)} aria-label={`New password for ${u.name}`}>
                  New password
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={toggle.isPending && toggle.variables?._id === u._id}
                  onClick={() => toggle.mutate(u)}
                  aria-label={`${u.status === "active" ? "Switch off" : "Switch on"} ${u.name}`}
                >
                  {u.status === "active" ? "Switch off" : "Switch on"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoveFor(u)} aria-label={`Remove ${u.name}`}>
                  Remove…
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddLogin
          customerId={customerId}
          onClose={() => setAdding(false)}
          onMade={(login, password) => {
            setAdding(false);
            setGiven({ login, password, isNew: true });
            void refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!resetFor}
        title={`A new password for ${resetFor?.name ?? ""}?`}
        message="The password they have stops working and they are signed out everywhere. You will be shown the new one, once, to give them."
        confirmLabel="Make a new password"
        loading={reset.isPending}
        onConfirm={() => resetFor && reset.mutate(resetFor)}
        onCancel={() => setResetFor(null)}
      />
      <ConfirmDialog
        open={!!removeFor}
        danger
        title={`Remove ${removeFor?.name ?? ""}'s login?`}
        message="They can no longer sign in. To stop them for a while instead, switch the login off."
        confirmLabel="Remove login"
        loading={remove.isPending}
        onConfirm={() => removeFor && remove.mutate(removeFor)}
        onCancel={() => setRemoveFor(null)}
      />

      {given && <GivePassword given={given} onClose={() => setGiven(null)} />}
    </Card>
  );
}

function AddLogin({
  customerId,
  onClose,
  onMade,
}: {
  customerId: string;
  onClose: () => void;
  onMade: (login: PortalLogin, password: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<PortalRole>("buyer");
  const make = useMutation({
    mutationFn: async () => {
      const password = newPortalPassword();
      const login = await portalLoginService.create(customerId, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        password,
      });
      return { login, password };
    },
    onSuccess: ({ login, password }) => onMade(login, password),
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not make the login", "error"),
  });
  const badEmail = email.trim() !== "" && !EMAIL.test(email.trim());
  const blocked = name.trim().length < 2 || !EMAIL.test(email.trim());
  const sees = PORTAL_ROLES.find((r) => r.value === role)?.sees;

  return (
    <Modal open onClose={onClose} title="Add a portal login" width="max-w-md">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) make.mutate();
        }}
      >
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={badEmail ? "That is not an email address" : undefined}
          hint="What they sign in with."
        />
        <Input label="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
        <Select
          label="What they can see"
          value={role}
          onChange={(e) => setRole(e.target.value as PortalRole)}
          options={PORTAL_ROLES.map((r) => ({ value: r.value, label: r.label }))}
        />
        {sees && <p className="text-xs text-ink-500">{sees}.</p>}
        <p className="text-xs text-ink-500">A password is made for them and shown to you once, to pass on.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={make.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={blocked} loading={make.isPending}>
            Add login
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function GivePassword({ given, onClose }: { given: Given; onClose: () => void }) {
  const { toast } = useToast();
  const details = `Sign in at ${config.portalUrl}\nEmail: ${given.login.email}\nPassword: ${given.password}`;
  const copy = (text: string) =>
    void navigator.clipboard?.writeText(text).then(
      () => toast("Copied", "success"),
      () => undefined,
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={given.isNew ? `${given.login.name} can sign in` : `${given.login.name}'s new password`}
      width="max-w-md"
      confirmDirtyClose={false}
    >
      <p className="text-sm text-ink-600">
        Give them this by phone or WhatsApp. It is shown only now: if it is lost, make a new one.
      </p>
      <dl className="mt-4 space-y-2 rounded-lg bg-canvas p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">Sign in at</dt>
          <dd className="font-medium text-ink-900">{portalHost}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">Email</dt>
          <dd className="truncate font-medium text-ink-900">{given.login.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-500">Password</dt>
          <dd className="font-mono text-base font-semibold tracking-wide text-ink-900" aria-label="Password">
            {given.password}
          </dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => copy(given.password)}>
          <Copy className="h-4 w-4" aria-hidden /> Copy password
        </Button>
        <Button variant="secondary" onClick={() => copy(details)}>
          <Copy className="h-4 w-4" aria-hidden /> Copy all
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
