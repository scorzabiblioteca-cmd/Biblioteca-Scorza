import { withAuth, ok, created, body, page } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";
import { profesorSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const GET = withAuth(["BIBLIOTECARIO"], async (req) => {
  const { page: p, pageSize, offset } = page(req);
  const t = req.nextUrl.searchParams.get("q")?.trim();
  const params: unknown[] = t ? [`%${t}%`] : [];
  const W = t ? "WHERE apellidos ILIKE $1 OR nombres ILIKE $1 OR dni ILIKE $1" : "";
  const total = (await q1<{ n: number }>(pool, `SELECT count(*)::int AS n FROM profesores ${W}`, params))!.n;
  const items = await q(pool, `SELECT * FROM profesores ${W} ORDER BY apellidos, nombres LIMIT ${pageSize} OFFSET ${offset}`, params);
  return ok({ items, page: p, pageSize, total });
});

export const POST = withAuth(["BIBLIOTECARIO"], async (req, { session }) => {
  const d = await body(req, profesorSchema);
  const r = await q1<{ id: number }>(pool,
    "INSERT INTO profesores (dni, nombres, apellidos, correo, telefono, area) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [d.dni, d.nombres, d.apellidos, d.correo ?? null, d.telefono, d.area]);
  await audit(pool, session, "CREAR_PROFESOR", "profesores", r!.id, null, d, req);
  return created(r, "Profesor registrado correctamente");
});
