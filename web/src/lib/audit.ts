import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { Db } from "./db";
import type { Session } from "./auth";

export async function audit(
  db: Db,
  s: Session | null,
  accion: string,
  entidad: string,
  entidadId: string | number | null,
  antes: unknown,
  despues: unknown,
  req?: NextRequest
) {
  const ipRaw = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ip = ipRaw && isIP(ipRaw) ? ipRaw : null;
  await db.query(
    `INSERT INTO auditoria (usuario_id, usuario_username, accion, entidad, entidad_id,
                            datos_anteriores, datos_nuevos, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      s?.id ?? null, s?.username ?? null, accion, entidad, entidadId === null ? null : String(entidadId),
      antes == null ? null : JSON.stringify(antes), despues == null ? null : JSON.stringify(despues),
      ip, req?.headers.get("user-agent") ?? null,
    ]
  );
}
