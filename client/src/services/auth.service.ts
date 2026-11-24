import { api } from "./api";
import type { User, UserRole } from "../types";

export interface SyncPayload {
  name?: string;
  email?: string;
}

export const syncUserWithBackend = (
  payload?: SyncPayload
): Promise<{ ok: boolean; user: User }> =>
  api.post<{ ok: boolean; user: User }>("/auth/sync", payload || {}).then((r) => r.data);

export const getCurrentUserProfile = (): Promise<{ ok: boolean; user: User }> =>
  api.get<{ ok: boolean; user: User }>("/auth/me").then((r) => r.data);

export const updateRole = (
  role: UserRole
): Promise<{ ok: boolean; user: User }> =>
  api.patch<{ ok: boolean; user: User }>("/auth/role", { role }).then((r) => r.data);
