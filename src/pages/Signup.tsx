import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Alert, AuthLayout } from "../components/AuthLayout";
import { Field } from "../components/Field";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { PASSWORD_MIN, validateEmail, validateFullName, validatePassword } from "../lib/validation";
import { signUp } from "../services/auth";

export default function Signup() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string | null>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  if (status === "signedIn" && !confirmEmail) return <Navigate to="/onboarding" replace />;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = {
      fullName: validateFullName(form.fullName),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
    };
    setErrors(next);
    setFormError(null);
    if (next.fullName || next.email || next.password) return;
    setBusy(true);
    const result = await signUp(form);
    setBusy(false);
    if (!result.ok) return setFormError(result.message);
    if (result.data.needsEmailConfirmation) setConfirmEmail(form.email.trim());
    else navigate("/onboarding", { replace: true });
  }

  if (confirmEmail) {
    return (
      <>
        <Seo seo={{ ...PAGE_META.signup, noindex: true }} />
        <AuthLayout title="Check your email">
          <Alert kind="success">
            We sent a confirmation link to <strong>{confirmEmail}</strong>. Open it to finish creating your account,
            then set up your store.
          </Alert>
          <p className="auth-links">
            <span>
              Wrong address?{" "}
              <button type="button" className="link-button" onClick={() => setConfirmEmail(null)}>
                Go back
              </button>
            </span>
          </p>
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <Seo seo={{ ...PAGE_META.signup, noindex: true }} />
      <AuthLayout title="Create your store" subtitle="Start with your account. Your store link comes next.">
        <form onSubmit={onSubmit} noValidate>
          <Field
            label="Full name"
            autoComplete="name"
            value={form.fullName}
            onChange={set("fullName")}
            error={errors.fullName}
          />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`}
          />
          {formError && <Alert kind="error">{formError}</Alert>}
          <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
            {busy ? "Creating account…" : "Create account"} <ArrowRight size={16} />
          </button>
          <p className="auth-fineprint">
            By creating an account you agree to our <Link to="/terms">Terms</Link> and{" "}
            <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </form>
        <p className="auth-links">
          <span>
            Already have an account? <Link to="/login">Log in</Link>
          </span>
        </p>
      </AuthLayout>
    </>
  );
}
