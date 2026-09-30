import { withAuth, ok, created, body } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";
import { ubicacionSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { UBIC_TXT } from "@/lib/sql";

export const GET = withAuth(["BIBLIOTECARIO"], async () =>
  ok(await q(pool, `SELECT u.id, u.codigo, ${UBIC_TXT} AS descripcion FROM ubicaciones u WHERE u.activo ORDER BY u.codigo`)));

export const POST = withAuth(["BIBLIOTECARIO"], async (req, { session }) => {
  const d = await body(req, ubicacionSchema);
  const r = await q1<{ id: number }>(pool,
    `INSERT INTO ubicaciones (codigo, sede, biblioteca, seccion, estante, nivel, aula, almacen)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, codigo`,
    [d.codigo.toUpperCase(), d.sede, d.biblioteca, d.seccion, d.estante, d.nivel, d.aula, d.almacen]);
  await audit(pool, session, "CREAR_UBICACION", "ubicaciones", r!.id, null, d, req);
  return created(r, "Ubicación creada correctamente");
});
