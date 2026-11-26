import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Alert, AuthLayout } from "../components/AuthLayout";
import { Field } from "../components/Field";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { safeNextPath, validateEmail } from "../lib/validation";
import { signIn } from "../services/auth";

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  if (status === "signedIn") return <Navigate to={next} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateEmail(email);
    setEmailError(invalid);
    setError(null);
    if (invalid) return;
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    navigate(next, { replace: true });
  }

  return (
    <>
      <Seo seo={{ ...PAGE_META.login, noindex: true }} />
      <AuthLayout title="Welcome back" subtitle="Log in to manage your store.">
        <form onSubmit={onSubmit} noValidate>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <Field
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailingAction={<button className="field-visibility-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}><span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>}
          />
          {error && <Alert kind="error">{error}</Alert>}
          <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"} <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-links">
          <Link to="/forgot-password">Forgot your password?</Link>
          <span>
            New to SellSharp? <Link to="/signup">Create your store</Link>
          </span>
        </p>
      </AuthLayout>
    </>
  );
}
