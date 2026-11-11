import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Alert, AuthLayout } from "../components/AuthLayout";
import { Field } from "../components/Field";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { validatePassword } from "../lib/validation";
import { updatePassword } from "../services/auth";

/** Opened from the email link: Supabase signs the vendor in with a short-lived recovery session, then they choose a new password. */
export default function ResetPassword() {
  const { status } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = {
      password: validatePassword(password),
      confirm: password !== confirm ? "The passwords don't match." : null,
    };
    setErrors(next);
    setError(null);
    if (next.password || next.confirm) return;
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setDone(true);
  }

  let body;
  if (status === "loading")
    body = (
      <p className="auth-loading" role="status">
        Checking your link…
      </p>
    );
  else if (status === "signedOut") {
    body = (
      <>
        <Alert kind="error">This reset link has expired or was already used.</Alert>
        <p className="auth-links">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </>
    );
  } else if (done) {
    body = (
      <>
        <Alert kind="success">Your password has been updated.</Alert>
        <Link to="/onboarding" className="btn btn-primary btn-full">
          Continue <ArrowRight size={16} />
        </Link>
      </>
    );
  } else {
    body = (
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        {error && <Alert kind="error">{error}</Alert>}
        <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save new password"} <ArrowRight size={16} />
        </button>
      </form>
    );
  }

  return (
    <>
      <Seo seo={{ ...PAGE_META.resetPassword, noindex: true }} />
      <AuthLayout title="Choose a new password">{body}</AuthLayout>
    </>
  );
}
