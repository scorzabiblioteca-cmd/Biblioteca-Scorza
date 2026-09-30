import { withAuth, ok, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const a = await q1(pool,
    "SELECT id, codigo_alumno, dni, nombres, apellidos, nivel_educativo, grado, seccion, estado FROM alumnos WHERE codigo_alumno = $1",
    [decodeURIComponent(params.codigo).trim()]);
  if (!a) throw new HttpError(404, "Alumno no encontrado", "ALUMNO_NO_ENCONTRADO");
  return ok(a);
});
