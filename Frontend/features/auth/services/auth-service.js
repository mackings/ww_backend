import { apiRequest, unwrapData } from "@/services/api-client";

export async function signIn(credentials) {
  return unwrapData(await apiRequest("/api/auth/signin", {
    method: "POST",
    body: credentials
  }));
}

export async function signUp(account) {
  return unwrapData(await apiRequest("/api/auth/signup", {
    method: "POST",
    body: account
  }));
}

export async function getCurrentUser(token) {
  const payload = unwrapData(await apiRequest("/api/auth/me", { token }));
  return payload?.user || payload;
}

export const requestPasswordOtp = (body) => apiRequest("/api/auth/forgot-password", { method: "POST", body });
export const verifyPasswordOtp = (body) => apiRequest("/api/auth/verify-otp", { method: "POST", body });
export const resetPassword = (body) => apiRequest("/api/auth/reset-password", { method: "POST", body });
export const switchCompany = (token, companyIndex) => apiRequest("/api/auth/switch-company", {
  method: "POST",
  token,
  body: { companyIndex }
});
