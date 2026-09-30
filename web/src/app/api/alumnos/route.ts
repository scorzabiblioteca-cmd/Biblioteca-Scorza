import { withAuth, ok, created, body, page } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";
import { alumnoSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { norm } from "@/lib/sql";

const COLS = `id, codigo_alumno, dni, nombres, apellidos, nivel_educativo, grado, seccion, telefono, correo, estado, fecha_registro`;

export const GET = withAuth(["BIBLIOTECARIO"], async (req) => {
  const sp = req.nextUrl.searchParams;
  const { page: p, pageSize, offset } = page(req);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);
  if (sp.get("grado")) where.push(`grado = ${add(Number(sp.get("grado")))}`);
  if (sp.get("seccion")) where.push(`seccion = ${add(sp.get("seccion"))}`);
  if (sp.get("estado")) where.push(`estado = ${add(sp.get("estado"))}`);
  const t = sp.get("q")?.trim();
  if (t) {
    const n = add(t);
    where.push(`(${norm("apellidos || ' ' || nombres")} LIKE '%' || ${norm(n)} || '%' OR ${norm("nombres || ' ' || apellidos")} LIKE '%' || ${norm(n)} || '%' OR dni LIKE '%' || ${n} || '%' OR codigo_alumno ILIKE '%' || ${n} || '%')`);
  }
  const W = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (await q1<{ n: number }>(pool, `SELECT count(*)::int AS n FROM alumnos ${W}`, params))!.n;
  const items = await q(pool, `SELECT ${COLS} FROM alumnos ${W} ORDER BY apellidos, nombres LIMIT ${add(pageSize)} OFFSET ${add(offset)}`, params);
  return ok({ items, page: p, pageSize, total });
});

export const POST = withAuth(["BIBLIOTECARIO"], async (req, { session }) => {
  const d = await body(req, alumnoSchema);
  const a = await q1<{ id: number }>(
    pool,
    `INSERT INTO alumnos (codigo_alumno, dni, nombres, apellidos, nivel_educativo, grado, seccion, telefono, correo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLS}`,
    [d.codigoAlumno, d.dni, d.nombres, d.apellidos, d.nivelEducativo ?? null, d.grado ?? null, d.seccion?.toUpperCase() ?? null, d.telefono, d.correo ?? null]
  );
  await audit(pool, session, "CREAR_ALUMNO", "alumnos", a!.id, null, d, req);
  return created(a, "Alumno registrado correctamente");
});
