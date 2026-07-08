import { httpClient } from "@/core/http/httpClient";
import { Employee, EmployeeDetail, EmployeeFormValues } from "./types";

export const employeeService = {
  async list(department: string): Promise<Employee[]> {
    const res = await httpClient.get<{ success: boolean; employees: Employee[] }>(
      "/employee/get-employees",
      department && department !== "all" ? { department } : undefined
    );
    return res.employees;
  },

  async getById(id: string): Promise<EmployeeDetail> {
    const res = await httpClient.get<{ success: boolean; employee: EmployeeDetail }>(
      "/employee/get-employee-detail",
      { id }
    );
    return res.employee;
  },

  async create(body: EmployeeFormValues): Promise<Employee> {
    const res = await httpClient.post<{ success: boolean; employee: Employee }>(
      "/employee/create-employee",
      body
    );
    return res.employee;
  },

  async update(id: string, body: Partial<EmployeeFormValues> & { skill?: number }): Promise<Employee> {
    const res = await httpClient.put<{ success: boolean; employee: Employee }>(
      `/employee/update?id=${encodeURIComponent(id)}`,
      body
    );
    return res.employee;
  },

  async setPerformance(id: string, performance: number): Promise<void> {
    await httpClient.patch("/employee/performance", { id, performance });
  },
};
