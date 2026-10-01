export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { credentials: "same-origin", ...options, headers: options.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...options.headers } });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || `HTTP ${response.status}`);
  return result as T;
}
export const send = <T = any>(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown) => api<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
