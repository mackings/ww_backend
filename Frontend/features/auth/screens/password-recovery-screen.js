"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/features/auth/components/auth-card";
import { requestPasswordOtp, resetPassword, verifyPasswordOtp } from "@/features/auth/services/auth-service";
import { unwrapData } from "@/services/api-client";

export function PasswordRecoveryScreen() {
  const [step, setStep] = useState("identity");
  const [form, setForm] = useState({ email: "", userId: "", otp: "", resetToken: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (step === "identity") {
        const result = await requestPasswordOtp({ method: "email", email: form.email });
        setForm({ ...form, userId: result.userId });
        setStep("otp");
      } else if (step === "otp") {
        const result = unwrapData(await verifyPasswordOtp({ userId: form.userId, otp: form.otp }));
        setForm({ ...form, resetToken: result.resetToken });
        setStep("password");
      } else {
        if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");
        await resetPassword({ resetToken: form.resetToken, password: form.password });
        router.replace("/login");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={step === "identity" ? "Recover your account" : step === "otp" ? "Verify your code" : "Set a new password"}
      subtitle={step === "identity" ? "We will send a one-time code to your email." : step === "otp" ? "Enter the code sent to your email." : "Use at least eight characters."}
      footer={{ text: "Remembered your password?", label: "Return to sign in", href: "/login" }}
    >
      <form className="form-stack" onSubmit={submit}>
        {step === "identity" && <label>Email<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>}
        {step === "otp" && <label>One-time code<input required inputMode="numeric" value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value })} /></label>}
        {step === "password" && <>
          <label>New password<input type="password" required minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <label>Confirm password<input type="password" required minLength="8" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
        </>}
        {error && <div className="alert error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? "Please wait..." : step === "identity" ? "Send code" : step === "otp" ? "Verify code" : "Reset password"}</button>
      </form>
    </AuthCard>
  );
}
