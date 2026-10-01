import { httpClient } from "@/core/http/httpClient";

export interface ManagedUser {
  _id: string;
  name: string;
  /** Null for a worker login: it signs in by phone and PIN, with no real address. */
  email: string | null;
  role: string;
  department?: string | null;
  features?: string[];
  createdAt?: string;
  /** The employee record this login belongs to, if any. */
  employee?: { _id: string; name: string; department?: string } | null;
  /** An employee login: sees only their own work (the server's rule). */
  selfService?: boolean;
  phoneSignIn?: boolean;
}

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  department: string;
  features?: string[];
  employee?: string | null;
  selfService?: boolean;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  password?: string;
  department?: string;
  features?: string[];
  /** An id links; null unlinks; absent leaves the link alone. */
  employee?: string | null;
  selfService?: boolean;
}

export const usersService = {
  async list(): Promise<{ users: ManagedUser[]; departments: string[] }> {
    const res = await httpClient.get<{ success: boolean; users: ManagedUser[]; departments: string[] }>(
      "/user/manage/list"
    );
    return { users: res.users, departments: res.departments };
  },
  create: (body: UserCreateInput) =>
    httpClient.post<{ success: boolean }>("/user/manage/create", body),
  update: (id: string, body: UserUpdateInput) =>
    httpClient.put<{ success: boolean }>(`/user/manage/${id}`, body),
  remove: (id: string) =>
    httpClient.delete<{ success: boolean }>(`/user/manage/${id}`),
};
