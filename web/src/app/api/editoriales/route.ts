import { withAuth, ok } from "@/lib/http";
import { q, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async () =>
  ok(await q(pool, "SELECT id, nombre FROM editoriales ORDER BY nombre")));
