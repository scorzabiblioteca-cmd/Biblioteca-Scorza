import { withAuth, ok, body, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { alumnoSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { z } from "zod";

const editAlumnoSchema = alumnoSchema.extend({
  estado: z.enum(["ACTIVO", "INACTIVO", "RETIRADO"]),
});
const COLS = `id, codigo_alumno, dni, nombres, apellidos, nivel_educativo, grado, seccion, telefono, correo, estado, fecha_registro`;

export const PUT = withAuth(["BIBLIOTECARIO"], async (req, { params, session }) => {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Identificador de alumno no válido");
  const d = await body(req, editAlumnoSchema);
  const antes = await q1(pool, `SELECT ${COLS} FROM alumnos WHERE id = $1`, [id]);
  if (!antes) throw new HttpError(404, "Alumno no encontrado");
  const actualizado = await q1(
    pool,
    `UPDATE alumnos SET codigo_alumno=$2, dni=$3, nombres=$4, apellidos=$5, nivel_educativo=$6,
       grado=$7, seccion=$8, telefono=$9, correo=$10, estado=$11, updated_at=now()
     WHERE id=$1 RETURNING ${COLS}`,
    [id, d.codigoAlumno, d.dni, d.nombres, d.apellidos, d.nivelEducativo ?? null, d.grado ?? null,
      d.seccion?.toUpperCase() ?? null, d.telefono, d.correo ?? null, d.estado]
  );
  await audit(pool, session, "EDITAR_ALUMNO", "alumnos", id, antes, actualizado, req);
  return ok(actualizado, "Alumno actualizado correctamente");
});
