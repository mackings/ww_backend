import { apiRequest, unwrapData } from "@/services/api-client";

export async function loadDashboard({ token, isAdmin }) {
  const requests = [
    apiRequest(isAdmin ? "/api/platform/dashboard/stats" : "/api/orders/stats", { token }),
    apiRequest("/api/product/materials", { token }),
    apiRequest("/api/notifications/unread-count", { token }),
    apiRequest("/api/quotation", { token, query: { page: 1, limit: 5 } }),
    apiRequest("/api/product", { token, query: { page: 1, limit: 10 } }),
    isAdmin ? apiRequest("/api/platform/companies", { token, query: { page: 1, limit: 1 } }) : Promise.resolve(null)
  ];
  const [dashboardResult, materialsResult, notificationResult, quotationsResult, productsResult, companiesResult] = await Promise.allSettled(requests);

  return {
    dashboard: dashboardResult.status === "fulfilled" ? unwrapData(dashboardResult.value) : null,
    materials: materialsResult.status === "fulfilled" ? materialsResult.value : null,
    notifications: notificationResult.status === "fulfilled" ? unwrapData(notificationResult.value) : null,
    quotations: quotationsResult.status === "fulfilled" ? quotationsResult.value?.data || [] : [],
    products: productsResult.status === "fulfilled" ? productsResult.value?.data || [] : [],
    companiesTotal: companiesResult.status === "fulfilled" ? companiesResult.value?.pagination?.total : null,
    unavailable: [dashboardResult, materialsResult].every((result) => result.status === "rejected")
  };
}
