import { useSyncExternalStore } from "react";
import { getAuthSnapshot, getServerAuthSnapshot, subscribeAuth, type AuthState } from "./authStore";

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);
}
