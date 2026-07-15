import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useEmployees, useEmployeeMutations } from "./hooks";
import { DEPARTMENTS, Employee } from "./types";
import { EmployeeForm } from "./EmployeeForm";

const columns: Column<Employee>[] = [
  {
    key: "name",
    header: "Employee",
    render: (e) => (
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 rounded-full bg-brand-100 text-brand-600 grid place-items-center text-xs font-bold uppercase">
          {e.name.charAt(0)}
        </span>
        <div>
          <p className="font-medium">{e.name}</p>
          <p className="text-xs text-ink-400">{e.role || "—"}</p>
        </div>
      </div>
    ),
  },
  { key: "dept", header: "Department", render: (e) => <span className="capitalize">{e.department}</span> },
  { key: "phone", header: "Phone", render: (e) => e.phoneNumber || "—" },
  { key: "skill", header: "Skill", align: "right", sort: (e) => e.skill ?? 0, render: (e) => e.skill ?? "—" },
  {
    key: "performance",
    header: "Performance",
    align: "right",
    sort: (e) => e.performance ?? 0,
    render: (e) =>
      e.performance != null ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-16 rounded-full bg-ink-100 overflow-hidden">
            <span
              className="block h-full rounded-full bg-brand-500"
              style={{ width: `${Math.min(100, e.performance)}%` }}
            />
          </span>
          <span className="tabular-nums">{e.performance}</span>
        </span>
      ) : (
        "—"
      ),
  },
];

export function EmployeeListPage() {
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useEmployees(department);
  const { create } = useEmployeeMutations();

  const rows = useMemo(() => {
    const list = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.phoneNumber ?? "").includes(q) ||
        (e.role ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={data ? `${rows.length} of ${data.length} employees` : undefined}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add employee
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, phone or role…"
          className="w-full max-w-sm"
        />
        <FilterChips
          options={[{ value: "all", label: "All" }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
          value={department}
          onChange={setDepartment}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(e) => e._id}
          onRowClick={(e) => navigate(`/employees/${e._id}`)}
          loading={isLoading}
          emptyTitle="No employees found"
        />
      </Card>

      <FormScreen open={createOpen} onClose={() => setCreateOpen(false)} title="Add employee">
        <EmployeeForm
          submitting={create.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                setCreateOpen(false);
                toast("Employee added", "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to add employee", "error"),
            })
          }
        />
      </FormScreen>
    </>
  );
}
