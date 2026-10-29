import { z } from "zod";
import { publicRoute, body, ok, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { checkPassword, signResetTicket } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  username: z.string().trim().min(1).max(50),
  codigo: z.string().trim().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});
const MAX_INTENTOS = 5;
const INVALIDO = "Código inválido o expirado. Solicita uno nuevo.";

export const POST = publicRoute(async (req) => {
  const { username, codigo } = await body(req, schema);
  const u = await q1<{ id: number; username: string; activo: boolean }>(
    pool,
    "SELECT id, username, activo FROM usuarios WHERE lower(username) = lower($1)",
    [username]
  );
  if (!u || !u.activo) throw new HttpError(400, INVALIDO);

  const r = await q1<{ id: number; codigoHash: string; intentos: number }>(
    pool,
    `SELECT id, codigo_hash, intentos FROM password_resets
      WHERE usuario_id = $1 AND usado_en IS NULL AND expira_en > now()
      ORDER BY created_at DESC
      LIMIT 1`,
    [u.id]
  );
  if (!r || r.intentos >= MAX_INTENTOS) throw new HttpError(400, INVALIDO);

  const valido = await checkPassword(codigo, r.codigoHash);
  if (!valido) {
    const intentos = r.intentos + 1;
    await pool.query(
      `UPDATE password_resets
          SET intentos = $2,
              usado_en = CASE WHEN $2 >= $3 THEN now() ELSE usado_en END
        WHERE id = $1`,
      [r.id, intentos, MAX_INTENTOS]
    );
    await audit(pool, null, "RECUPERACION_CODIGO_FALLIDO", "usuarios", u.id, null, { username: u.username, intentos }, req);
    throw new HttpError(
      400,
      intentos >= MAX_INTENTOS
        ? "Demasiados intentos fallidos. Solicita un nuevo código."
        : "Código incorrecto. Verifica e intenta nuevamente."
    );
  }

  await pool.query("UPDATE password_resets SET usado_en = now() WHERE id = $1", [r.id]);
  const ticket = await signResetTicket(u.id);
  await audit(pool, null, "RECUPERACION_CODIGO_VERIFICADO", "usuarios", u.id, null, { username: u.username }, req);
  return ok({ ticket }, "Código verificado");
});
