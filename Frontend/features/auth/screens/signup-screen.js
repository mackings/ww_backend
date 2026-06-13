"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/features/auth/components/auth-card";
import { useAuth } from "@/features/auth/context/auth-context";
import { signUp } from "@/features/auth/services/auth-service";

const initialForm = { fullname: "", email: "", phoneNumber: "", password: "", companyName: "", companyEmail: "" };

export function SignupScreen() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { storeSession } = useAuth();
  const router = useRouter();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      storeSession(await signUp(form));
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create your workspace"
      subtitle="Set up an owner account and your first company."
      footer={{ text: "Already registered?", label: "Sign in", href: "/login" }}
    >
      <form className="form-grid" onSubmit={submit}>
        {Object.keys(initialForm).map((key) => (
          <label key={key} className={key === "password" ? "" : undefined}>
            {key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())}
            <input
              type={key === "password" ? "password" : key.includes("email") || key.includes("Email") ? "email" : "text"}
              required={["fullname", "email", "phoneNumber", "password"].includes(key)}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        {error && <div className="alert error full">{error}</div>}
        <button className="primary-button full" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
      </form>
    </AuthCard>
  );
}
