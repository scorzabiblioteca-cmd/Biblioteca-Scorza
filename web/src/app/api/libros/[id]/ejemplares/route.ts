import { z } from "zod";
import { withAuth, created, body, HttpError } from "@/lib/http";
import { q1, tx, pool } from "@/lib/db";
import { CONDICIONES } from "@/lib/validators";
import { agregarUnidades, LIBRO_SELECT } from "@/lib/libros";
import { audit } from "@/lib/audit";

const schema = z.object({
  cantidad: z.coerce.number().int().min(1).max(500).default(1),
  ubicacionId: z.coerce.number().int().positive().optional().nullable(),
  condicion: z.enum(CONDICIONES).default("BUENO"),
});

export const POST = withAuth(["BIBLIOTECARIO"], async (req, { params, session }) => {
  const id = Number(params.id);
  const d = await body(req, schema);
  const libro = await q1<{ id: number; tipoControl: string; prefijoCodigo: string; estado: string }>(
    pool, "SELECT id, tipo_control, prefijo_codigo, estado FROM libros WHERE id = $1", [id]
  );
  if (!libro) throw new HttpError(404, "Libro no encontrado");
  if (libro.estado === "ARCHIVADO") throw new HttpError(409, "El libro está archivado");
  const r = await tx(async (c) => {
    const res = await agregarUnidades(c, libro, d.cantidad, d.ubicacionId ?? null, d.condicion, session.id);
    await audit(c, session, "AGREGAR_UNIDADES", "libros", id, null, { cantidad: d.cantidad, codigos: res.codigos }, req);
    return res;
  });
  const actualizado = await q1(pool, `${LIBRO_SELECT} WHERE l.id = $1`, [id]);
  return created({ libro: actualizado, codigos: r.codigos },
    libro.tipoControl === "INDIVIDUAL" ? "Ejemplar(es) agregado(s) correctamente" : "Stock actualizado correctamente");
});
