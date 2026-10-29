import { z } from "zod";
import { publicRoute, body, ok, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { hashPassword, verifyResetTicket } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  ticket: z.string().min(1),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña es demasiado larga"),
});

export const POST = publicRoute(async (req) => {
  const { ticket, password } = await body(req, schema);
  const id = await verifyResetTicket(ticket);
  if (!id) throw new HttpError(400, "La verificación expiró. Solicita un nuevo código.");

  const u = await q1<{ id: number; username: string; activo: boolean }>(
    pool,
    "SELECT id, username, activo FROM usuarios WHERE id = $1",
    [id]
  );
  if (!u || !u.activo) throw new HttpError(400, "La verificación expiró. Solicita un nuevo código.");

  const passwordHash = await hashPassword(password);
  await pool.query(
    `UPDATE usuarios
        SET password_hash = $2,
            intentos_fallidos = 0,
            bloqueado_hasta = NULL,
            updated_at = now()
      WHERE id = $1`,
    [u.id, passwordHash]
  );
  await pool.query("UPDATE password_resets SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL", [u.id]);
  await audit(pool, null, "PASSWORD_RESTABLECIDA", "usuarios", u.id, null, { username: u.username }, req);

  return ok(null, "Contraseña actualizada. Ya puedes iniciar sesión.");
});
