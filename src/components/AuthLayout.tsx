import type { ReactNode } from "react";
import { isBackendConfigured } from "../lib/supabase";

export function AuthLayout({
  title,
  subtitle,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="auth-page">
      <div className={`auth-card${wide ? " auth-card-wide" : ""}`}>
        <h1>{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {!isBackendConfigured && (
          <p className="auth-alert auth-alert-info" role="note">
            The backend isn't connected yet. Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your <code>.env</code> file.
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <p className={`auth-alert auth-alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
