BEGIN;

CREATE TABLE IF NOT EXISTS notificaciones (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id   BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo         VARCHAR(20) NOT NULL,
  titulo       VARCHAR(160) NOT NULL,
  mensaje      TEXT NOT NULL,
  enlace       TEXT NOT NULL,
  clave_unica  TEXT NOT NULL,
  leida_en     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_notificaciones_tipo CHECK (
    tipo IN ('PRESTAMO', 'DEVOLUCION', 'INVENTARIO', 'VENCIDO', 'POR_VENCER')
  ),
  CONSTRAINT uq_notificaciones_usuario_clave UNIQUE (usuario_id, clave_unica)
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_fecha
  ON notificaciones (usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_no_leida
  ON notificaciones (usuario_id, created_at DESC)
  WHERE leida_en IS NULL;

COMMIT;
