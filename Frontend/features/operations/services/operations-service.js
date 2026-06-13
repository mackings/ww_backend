import { apiRequest } from "@/services/api-client";

export async function loadResource(resource, token, query = {}) {
  return apiRequest(resource.path, {
    method: resource.method || "GET",
    token,
    query
  });
}

export async function submitOperation({
  path,
  method = "POST",
  token,
  body,
  multipart = false
}) {
  if (!multipart) {
    return apiRequest(path, { method, token, body });
  }

  const formData = new FormData();
  Object.entries(body || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    formData.append(key, value instanceof File ? value : typeof value === "object" ? JSON.stringify(value) : String(value));
  });

  return apiRequest(path, { method, token, formData });
}
