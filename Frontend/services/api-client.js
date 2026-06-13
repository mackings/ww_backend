const PROXY_ROOT = "/api/backend";

const buildUrl = (path, query = {}) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${PROXY_ROOT}${normalizedPath}`, window.location.origin);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return `${url.pathname}${url.search}`;
};

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    token,
    query,
    body,
    formData,
    signal
  } = options;
  const headers = {};

  if (token) headers.Authorization = `Bearer ${token}`;
  if (!formData && body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
    cache: "no-store",
    signal
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(payload?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function unwrapData(payload) {
  return payload?.data ?? payload;
}
