import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute, body, ok, HttpError } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";
import { checkPassword, signToken, COOKIE } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
const MAX_INTENTOS = 5;

export const POST = publicRoute(async (req) => {
  const { username, password } = await body(req, schema);
  const u = await q1<{
    id: number; username: string; nombreCompleto: string; passwordHash: string;
    activo: boolean; intentosFallidos: number; bloqueadoHasta: Date | null;
  }>(pool, "SELECT * FROM usuarios WHERE lower(username) = lower($1)", [username]);

  if (u?.bloqueadoHasta && u.bloqueadoHasta > new Date()) {
    throw new HttpError(403, "Cuenta bloqueada temporalmente por intentos fallidos. Intenta en 15 minutos.");
  }
  const valido = u ? await checkPassword(password, u.passwordHash) : false;
  if (!u || !u.activo || !valido) {
    if (u) {
      await pool.query(
        `UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1,
           bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2 THEN now() + interval '15 minutes' END
         WHERE id = $1`,
        [u.id, MAX_INTENTOS]
      );
    }
    await audit(pool, null, "LOGIN_FALLIDO", "usuarios", u?.id ?? null, null, { username }, req);
    throw new HttpError(401, "Usuario o contraseña incorrectos");
  }
  await pool.query("UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = now() WHERE id = $1", [u.id]);
  const roles = (await q<{ codigo: string }>(
    pool, "SELECT r.codigo FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = $1", [u.id]
  )).map((r) => r.codigo);
  const session = { id: u.id, username: u.username, roles };
  const token = await signToken(session);
  await audit(pool, session, "LOGIN", "usuarios", u.id, null, null, req);

  const res = NextResponse.json({
    success: true, message: "Sesión iniciada",
    data: { token, user: { id: u.id, username: u.username, nombreCompleto: u.nombreCompleto, roles } },
  });
  res.cookies.set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
  });
  return res;
});
