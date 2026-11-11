import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface AuthState {
  status: "loading" | "signedOut" | "signedIn";
  user: User | null;
}

const LOADING: AuthState = { status: "loading", user: null };
const SIGNED_OUT: AuthState = { status: "signedOut", user: null };

let state: AuthState = LOADING;
let started = false;
const listeners = new Set<() => void>();

const fromSession = (s: Session | null): AuthState => (s?.user ? { status: "signedIn", user: s.user } : SIGNED_OUT);

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Starts listening to Supabase once, in the browser. The callback only stores state (no other Supabase calls inside it). */
function start() {
  if (started) return;
  started = true;
  if (!supabase) {
    state = SIGNED_OUT;
    return;
  }
  void supabase.auth.getSession().then(({ data }) => set(fromSession(data.session)));
  supabase.auth.onAuthStateChange((_event, session) => set(fromSession(session)));
}

export function subscribeAuth(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getAuthSnapshot = (): AuthState => state;
/** What the server (and the first hydration pass) sees, so prerendered HTML always matches. */
export const getServerAuthSnapshot = (): AuthState => LOADING;

/** For tests only. */
export function __setAuthStateForTests(next: AuthState | null) {
  started = true;
  set(next ?? LOADING);
}
