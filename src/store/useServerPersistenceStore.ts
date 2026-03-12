import { create } from "zustand";

export type ServerPersistenceStatus =
  | "unknown"
  | "available"
  | "unavailable"
  | "unauthorized";

type ServerPersistenceState = {
  status: ServerPersistenceStatus;
  setStatus: (status: ServerPersistenceStatus) => void;
};

export const useServerPersistenceStore = create<ServerPersistenceState>((set) => ({
  status: "unknown",
  setStatus: (status) => set({ status }),
}));

