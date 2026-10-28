import { randomUUID } from "node:crypto";
import { Db } from "./db";

export type TipoNotificacion = "PRESTAMO" | "DEVOLUCION" | "INVENTARIO" | "VENCIDO" | "POR_VENCER";

export async function notificar(
  db: Db,
  notificacion: {
    tipo: TipoNotificacion;
    titulo: string;
    mensaje: string;
    enlace: string;
    claveUnica?: string;
  }
) {
  await db.query(
    `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, enlace, clave_unica)
     SELECT DISTINCT u.id, $1, $2, $3, $4, $5
     FROM usuarios u
     JOIN usuarios_roles ur ON ur.usuario_id = u.id
     JOIN roles r ON r.id = ur.rol_id
     WHERE u.activo AND r.codigo IN ('ADMIN', 'BIBLIOTECARIO')
     ON CONFLICT (usuario_id, clave_unica) DO NOTHING`,
    [
      notificacion.tipo,
      notificacion.titulo,
      notificacion.mensaje,
      notificacion.enlace,
      notificacion.claveUnica ?? randomUUID(),
    ]
  );
}
