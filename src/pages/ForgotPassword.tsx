import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Alert, AuthLayout } from "../components/AuthLayout";
import { Field } from "../components/Field";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { validateEmail } from "../lib/validation";
import { requestPasswordReset } from "../services/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateEmail(email);
    setEmailError(invalid);
    setError(null);
    if (invalid) return;
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setSent(true);
  }

  return (
    <>
      <Seo seo={{ ...PAGE_META.forgotPassword, noindex: true }} />
      <AuthLayout
        title="Reset your password"
        subtitle="Enter your email and we'll send you a link to choose a new one."
      >
        {sent ? (
          <Alert kind="success">
            If an account exists for {email.trim()}, a reset link is on its way. It may take a minute to arrive.
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
            {error && <Alert kind="error">{error}</Alert>}
            <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"} <ArrowRight size={16} />
            </button>
          </form>
        )}
        <p className="auth-links">
          <Link to="/login">Back to log in</Link>
        </p>
      </AuthLayout>
    </>
  );
}
