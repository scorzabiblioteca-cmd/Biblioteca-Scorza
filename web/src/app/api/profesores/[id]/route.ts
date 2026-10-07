import { withAuth, ok, body, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { profesorSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { z } from "zod";

const editProfesorSchema = profesorSchema.extend({
  estado: z.enum(["ACTIVO", "INACTIVO"]),
});

export const PUT = withAuth(["BIBLIOTECARIO"], async (req, { params, session }) => {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Identificador de profesor no válido");
  const d = await body(req, editProfesorSchema);
  const antes = await q1(pool, "SELECT * FROM profesores WHERE id = $1", [id]);
  if (!antes) throw new HttpError(404, "Profesor no encontrado");
  const actualizado = await q1(
    pool,
    `UPDATE profesores SET dni=$2, nombres=$3, apellidos=$4, correo=$5, telefono=$6, area=$7,
       estado=$8, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, d.dni, d.nombres, d.apellidos, d.correo ?? null, d.telefono, d.area, d.estado]
  );
  await audit(pool, session, "EDITAR_PROFESOR", "profesores", id, antes, actualizado, req);
  return ok(actualizado, "Profesor actualizado correctamente");
});
