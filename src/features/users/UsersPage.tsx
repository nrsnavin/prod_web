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
import { DEPARTMENTS, DEPARTMENT_LABELS } from "@/app/navigation";
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

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? usersService.update(user!._id, {
            name,
            email,
            department,
            ...(password ? { password } : {}),
          })
        : usersService.create({ name, email, password, department }),
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
    <FormScreen open onClose={onClose} title={isEdit ? "Edit user" : "Add user"} width="max-w-lg">
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label={isEdit ? "New password (leave blank to keep)" : "Password"}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Select
          label="Department"
          options={deptOptions}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
        <p className="text-xs text-ink-400">
          The department decides which screens this user sees. Backend access is derived from it
          (preparatory/weaving/packing → production, finance → accounts, admin → full access).
        </p>
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
      render: (u) => (
        <span className="inline-flex gap-1">
          <button onClick={() => setFormUser(u)} className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Edit user">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDelUser(u)} className="p-1.5 rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger" aria-label="Delete user">
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      ),
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
