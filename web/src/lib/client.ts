"use client";

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };

export async function api<T = any>(path: string, opts: { method?: string; json?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.json ? "POST" : "GET"),
    headers: opts.json ? { "Content-Type": "application/json" } : undefined,
    body: opts.json ? JSON.stringify(opts.json) : undefined,
    credentials: "same-origin",
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (res.status === 401 && !path.startsWith("/auth/login")) {
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }
  if (!res.ok || !data?.success) {
    const detalle = data?.errors ? " " + Object.values(data.errors).flat().join(", ") : "";
    throw new Error((data?.message ?? "Error de red") + detalle);
  }
  return data.data as T;
}

export const fecha = (v?: string | null) => (v ? new Date(v).toLocaleDateString("es-PE") : "—");
export const fechaHora = (v?: string | null) => (v ? new Date(v).toLocaleString("es-PE") : "—");
