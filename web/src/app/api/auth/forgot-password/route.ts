import { randomInt } from "node:crypto";
import { z } from "zod";
import { publicRoute, body, ok, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { enviarCodigoRecuperacion } from "@/lib/mailer";

const schema = z.object({ username: z.string().trim().min(1, "Escribe tu usuario").max(50) });
const VIGENCIA_MINUTOS = 15;
const MENSAJE = "Si el usuario existe, enviamos un código al correo de la biblioteca.";

export const POST = publicRoute(async (req) => {
  const { username } = await body(req, schema);
  const u = await q1<{ id: number; username: string; activo: boolean }>(
    pool,
    "SELECT id, username, activo FROM usuarios WHERE lower(username) = lower($1)",
    [username]
  );

  if (!u || !u.activo) {
    await audit(pool, null, "RECUPERACION_SOLICITADA", "usuarios", null, null, { username, encontrado: false }, req);
    return ok(null, MENSAJE);
  }

  const reciente = await q1<{ id: number }>(
    pool,
    `SELECT id FROM password_resets
      WHERE usuario_id = $1 AND created_at > now() - interval '1 minute'
      LIMIT 1`,
    [u.id]
  );
  if (reciente) return ok(null, MENSAJE);

  const codigo = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codigoHash = await hashPassword(codigo);

  await pool.query("UPDATE password_resets SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL", [u.id]);
  const fila = await q1<{ id: number }>(
    pool,
    `INSERT INTO password_resets (usuario_id, codigo_hash, expira_en)
     VALUES ($1, $2, now() + make_interval(mins => $3::int))
     RETURNING id`,
    [u.id, codigoHash, VIGENCIA_MINUTOS]
  );

  try {
    await enviarCodigoRecuperacion({ username: u.username, codigo, minutos: VIGENCIA_MINUTOS });
  } catch (e) {
    if (fila) await pool.query("DELETE FROM password_resets WHERE id = $1", [fila.id]);
    console.error("[RECUPERACION] No se pudo enviar el correo:", e);
    throw new HttpError(500, "No se pudo enviar el código. Intenta nuevamente en unos minutos.");
  }

  await audit(pool, null, "RECUPERACION_SOLICITADA", "usuarios", u.id, null, { username: u.username }, req);
  return ok(null, "Código enviado al correo de la biblioteca.");
});
