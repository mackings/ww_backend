"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/context/auth-context";
import { switchCompany } from "@/features/auth/services/auth-service";

export function CompanySelectionScreen() {
  const { user, token, refreshUser, ready } = useAuth();
  const [loadingIndex, setLoadingIndex] = useState(null);
  const [error, setError] = useState("");
  const router = useRouter();

  if (!ready || !user) return <div className="page-loader"><span className="spinner" />Loading companies...</div>;

  const select = async (index) => {
    setLoadingIndex(index);
    setError("");
    try {
      await switchCompany(token, index);
      await refreshUser(token);
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingIndex(null);
    }
  };

  return (
    <main className="company-select-page">
      <div className="company-select-shell">
        <span className="eyebrow">Choose workspace</span>
        <h1>Where are you working today?</h1>
        <p>Select a company to load its quotations, production, orders and financial records.</p>
        {error && <div className="alert error">{error}</div>}
        <div className="company-choice-grid">
          {(user.companies || []).filter((company) => company.accessGranted !== false).map((company, index) => (
            <button key={`${company.name}-${index}`} onClick={() => select(index)} disabled={loadingIndex !== null}>
              <span className="company-choice-icon">{company.name?.slice(0, 2).toUpperCase()}</span>
              <span><strong>{company.name}</strong><small>{company.position || company.role} · {company.role}</small></span>
              <span>{loadingIndex === index ? "Opening..." : "Open"}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
