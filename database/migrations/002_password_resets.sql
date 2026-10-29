BEGIN;

CREATE TABLE IF NOT EXISTS password_resets (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash TEXT NOT NULL,
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ,
  intentos    SMALLINT NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_usuario
  ON password_resets (usuario_id, created_at DESC);

COMMIT;
