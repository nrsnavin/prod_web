import { httpClient } from "@/core/http/httpClient";

export interface ManagedUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  createdAt?: string;
}

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  department: string;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  password?: string;
  department?: string;
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
