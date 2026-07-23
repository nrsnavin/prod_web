import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormScreen } from "@/components/ui/FormScreen";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  FEATURE_GROUPS,
  featuresForDepartment,
} from "@/app/navigation";
import { useAuth } from "@/core/auth/useAuth";
import { usersService, ManagedUser } from "./api";

const deptOptions = DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABELS[d] ?? d }));

function UserFormScreen({
  user,
  onClose,
}: {
  user: ManagedUser | null; // null = create
  onClose: () => void;
}) {
  const isEdit = !!user;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState(user?.department ?? "weaving");
  // Custom per-user feature access. Seeded from the user's saved set, or
  // the department default when creating.
  const [features, setFeatures] = useState<string[]>(
    user?.features ?? featuresForDepartment(user?.department ?? "weaving")
  );

  const featureSet = new Set(features);
  const toggle = (key: string) =>
    setFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  // Picking a department re-seeds the checklist to that department's
  // default; the admin can then tweak individual features.
  const pickDepartment = (dept: string) => {
    setDepartment(dept);
    setFeatures(featuresForDepartment(dept));
  };

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? usersService.update(user!._id, {
            name,
            email,
            department,
            features,
            ...(password ? { password } : {}),
          })
        : usersService.create({ name, email, password, department, features }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast(isEdit ? "User updated" : "User created", "success");
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Save failed", "error"),
  });

  const submit = () => {
    if (!name.trim() || !email.trim()) return toast("Name and email are required", "error");
    if (!isEdit && password.length < 4) return toast("Password must be at least 4 characters", "error");
    if (isEdit && password && password.length < 4) return toast("Password must be at least 4 characters", "error");
    save.mutate();
  };

  return (
    <FormScreen open onClose={onClose} title={isEdit ? "Edit user" : "Add user"} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={isEdit ? "New password (leave blank to keep)" : "Password"}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Select
            label="Preset (department)"
            options={deptOptions}
            value={department}
            onChange={(e) => pickDepartment(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-600">Feature access</p>
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-brand-600 hover:underline"
                onClick={() => setFeatures(FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key)))}>
                Select all
              </button>
              <button type="button" className="text-ink-400 hover:underline"
                onClick={() => setFeatures(FEATURE_GROUPS.flatMap((g) => g.features.filter((f) => f.always).map((f) => f.key)))}>
                Clear
              </button>
            </div>
          </div>
          <p className="mb-2 text-xs text-ink-400">
            Choose exactly what this user can open. The department above is just a starting preset;
            backend role access is still derived from it. Items marked "always" are visible to everyone.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-ink-200 p-3 space-y-3">
            {FEATURE_GROUPS.map((g) => {
              const keys = g.features.map((f) => f.key);
              const allOn = keys.every((k) => featureSet.has(k) || g.features.find((f) => f.key === k)?.always);
              return (
                <div key={g.section}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{g.section}</p>
                    <button type="button" className="text-[11px] text-brand-600 hover:underline"
                      onClick={() =>
                        setFeatures((prev) => {
                          const set = new Set(prev);
                          const optional = g.features.filter((f) => !f.always).map((f) => f.key);
                          const turnOff = optional.every((k) => set.has(k));
                          optional.forEach((k) => (turnOff ? set.delete(k) : set.add(k)));
                          return [...set];
                        })
                      }>
                      {allOn ? "none" : "all"}
                    </button>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                    {g.features.map((f) => (
                      <label key={f.key} className="flex items-center gap-2 text-sm text-ink-700">
                        <input
                          type="checkbox"
                          checked={f.always || featureSet.has(f.key)}
                          disabled={f.always}
                          onChange={() => toggle(f.key)}
                          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30 disabled:opacity-50"
                        />
                        <span className={f.always ? "text-ink-400" : ""}>
                          {f.label}
                          {f.always && <span className="ml-1 text-[10px] uppercase">always</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={save.isPending} onClick={submit}>
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}

export function UsersPage() {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["users"],
    queryFn: usersService.list,
  });

  const [formUser, setFormUser] = useState<ManagedUser | null | undefined>(undefined); // undefined = closed
  const [delUser, setDelUser] = useState<ManagedUser | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => usersService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast("User deleted", "success");
      setDelUser(null);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
  });

  const columns: Column<ManagedUser>[] = [
    { key: "name", header: "Name", render: (u) => <span className="font-medium">{u.name}</span> },
    { key: "email", header: "Email", render: (u) => <span className="text-ink-600">{u.email}</span> },
    {
      key: "department",
      header: "Department",
      render: (u) => (
        <StatusChip tone={u.department === "admin" ? "info" : "neutral"}>
          {DEPARTMENT_LABELS[u.department ?? ""] ?? u.department ?? u.role ?? "—"}
        </StatusChip>
      ),
    },
    {
      key: "act",
      header: "",
      align: "right",
      render: (u) => {
        // You can edit yourself (name/password) but never delete your
        // own account — the backend rejects it too; the UI simply
        // doesn't offer it.
        const isSelf = String(u._id) === String(me?.id);
        return (
          <span className="inline-flex items-center gap-1">
            {isSelf && <StatusChip tone="info">You</StatusChip>}
            <button onClick={() => setFormUser(u)} className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Edit user">
              <Pencil className="h-4 w-4" />
            </button>
            {!isSelf && (
              <button onClick={() => setDelUser(u)} className="p-1.5 rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger" aria-label="Delete user">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Create logins and assign each person a department."
        actions={
          <Button onClick={() => setFormUser(null)}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card className="mt-4">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.users ?? []}
            rowKey={(u) => u._id}
            emptyTitle="No users yet"
          />
        )}
      </Card>

      {formUser !== undefined && (
        <UserFormScreen user={formUser} onClose={() => setFormUser(undefined)} />
      )}

      <ConfirmDialog
        open={!!delUser}
        title="Delete user"
        message={`Remove ${delUser?.name}? They will no longer be able to log in.`}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onCancel={() => setDelUser(null)}
        onConfirm={() => delUser && remove.mutate(delUser._id)}
      />
    </>
  );
}
