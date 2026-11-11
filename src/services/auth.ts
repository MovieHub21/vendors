import { supabase } from "../lib/supabase";
import { fail, ok, type Result } from "./result";

const NOT_CONFIGURED = fail("not_configured", "The service isn't connected yet. Please try again later.");

/** Turns Supabase Auth errors into messages a vendor can act on (and never leaks internals). */
export function friendlyAuthError(error: { code?: string; message?: string; status?: number }): {
  code: string;
  message: string;
} {
  const code = error.code ?? "unknown";
  const text = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || text.includes("invalid login"))
    return { code, message: "Email or password is incorrect." };
  if (code === "email_not_confirmed")
    return { code, message: "Please confirm your email first. Check your inbox for the link." };
  if (code === "user_already_exists" || text.includes("already registered")) {
    return {
      code: "user_already_exists",
      message: "An account with this email already exists. Try logging in instead.",
    };
  }
  if (code === "weak_password") return { code, message: "That password is too easy to guess. Try a longer one." };
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error.status === 429) {
    return { code, message: "Too many attempts. Please wait a minute and try again." };
  }
  if (code === "same_password") return { code, message: "Choose a password you haven't used on this account before." };
  if (text.includes("network") || text.includes("fetch"))
    return { code: "network", message: "Can't reach the server. Check your connection and try again." };
  return { code, message: "Something went wrong. Please try again." };
}

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<Result<{ needsEmailConfirmation: boolean }>> {
  if (!supabase) return NOT_CONFIGURED;
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { full_name: input.fullName.trim() }, emailRedirectTo: `${origin()}/onboarding` },
  });
  if (error) {
    const f = friendlyAuthError(error);
    return fail(f.code, f.message);
  }
  return ok({ needsEmailConfirmation: !data.session });
}

export async function signIn(email: string, password: string): Promise<Result> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    const f = friendlyAuthError(error);
    return fail(f.code, f.message);
  }
  return ok(undefined);
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Always reports success so the form never reveals which emails have accounts. */
export async function requestPasswordReset(email: string): Promise<Result> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin()}/reset-password`,
  });
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    const f = friendlyAuthError(error);
    return fail(f.code, f.message);
  }
  return ok(undefined);
}

export async function updatePassword(password: string): Promise<Result> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const f = friendlyAuthError(error);
    return fail(f.code, f.message);
  }
  return ok(undefined);
}
