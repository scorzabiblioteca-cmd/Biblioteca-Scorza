import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession, Session } from "./auth";
import { q1, pool } from "./db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public errors?: Record<string, string[] | undefined>
  ) {
    super(message);
  }
}

export const ok = (data: unknown, message = "OK", status = 200) =>
  NextResponse.json({ success: true, data, message }, { status });
export const created = (data: unknown, message = "Creado correctamente") => ok(data, message, 201);

export function fail(status: number, message: string, code?: string, errors?: Record<string, string[] | undefined>) {
  return NextResponse.json({ success: false, message, code, errors }, { status });
}

type Ctx = { session: Session; params: Record<string, string> };
type Handler = (req: NextRequest, ctx: Ctx) => Promise<Response>;

/**
 * Envoltorio de TODOS los endpoints protegidos.
 * roles = roles permitidos (ADMIN siempre pasa). Convierte errores en respuestas JSON.
 */
export function withAuth(roles: string[], handler: Handler) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const session = await getSession(req);
      if (!session) throw new HttpError(401, "Sesión no válida o expirada");
      const u = await q1<{ activo: boolean }>(pool, "SELECT activo FROM usuarios WHERE id=$1", [session.id]);
      if (!u || !u.activo) throw new HttpError(401, "Usuario inactivo o inexistente");
      if (!session.roles.includes("ADMIN") && !roles.some((r) => session.roles.includes(r))) {
        throw new HttpError(403, "No tienes permiso para esta operación");
      }
      return await handler(req, { session, params: await context.params });
    } catch (e) {
      return handleError(e);
    }
  };
}

/** Para endpoints públicos (login). */
export function publicRoute(handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (e) {
      return handleError(e);
    }
  };
}

export function handleError(e: unknown) {
  if (e instanceof HttpError) return fail(e.status, e.message, e.code, e.errors);
  if (e instanceof ZodError) return fail(400, "Datos no válidos", "VALIDACION", e.flatten().fieldErrors);
  const err = e as { code?: string; message?: string; constraint?: string };
  if (err?.code === "23505") return fail(409, "Ya existe un registro con esos datos", "DUPLICADO");
  if (err?.code === "23503") return fail(409, "El registro está relacionado con otros datos", "REFERENCIA");
  if (err?.code === "23514") return fail(400, "Un valor no cumple las reglas de la base de datos", "RESTRICCION");
  if (err?.code === "P0001") return fail(409, err.message ?? "Operación no permitida", "REGLA");
  console.error("[API ERROR]", e);
  return fail(500, "Error interno del servidor");
}

export async function body<T>(req: NextRequest, schema: { parse: (v: unknown) => T }): Promise<T> {
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "El cuerpo debe ser JSON válido");
  }
  return schema.parse(json);
}

export function page(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pageN = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10) || 20));
  return { page: pageN, pageSize, offset: (pageN - 1) * pageSize };
}
