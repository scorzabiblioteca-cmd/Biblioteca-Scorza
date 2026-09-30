import { withAuth, ok, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { normalizarIsbn } from "@/lib/isbn";
import { LIBRO_SELECT } from "@/lib/libros";

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const isbn = normalizarIsbn(params.isbn);
  if (!isbn) throw new HttpError(400, "El ISBN no es válido", "ISBN_INVALIDO");
  const libro = await q1(pool, `${LIBRO_SELECT} WHERE l.isbn = $1`, [isbn]);
  if (!libro) throw new HttpError(404, "El libro no está registrado", "LIBRO_NO_ENCONTRADO");
  return ok(libro);
});
