"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/features/auth/components/auth-card";
import { useAuth } from "@/features/auth/context/auth-context";
import { signIn } from "@/features/auth/services/auth-service";

export function LoginScreen() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { storeSession } = useAuth();
  const router = useRouter();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await signIn(form);
      storeSession(session);
      router.replace(session.user?.companies?.length > 1 ? "/companies/select" : "/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your company or platform administrator account."
      footer={{ text: "New to WoodWork?", label: "Create an account", href: "/signup" }}
    >
      <form className="form-stack" onSubmit={submit}>
        <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>
        {error && <div className="alert error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </AuthCard>
  );
}
