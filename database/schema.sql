-- =====================================================================
-- BiblioScorza — schema.sql  (PostgreSQL 15+ / Neon)
-- Ejecutar sobre una base VACÍA:  npm run db:migrate  (en /web)
-- =====================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent no es IMMUTABLE; este wrapper permite usarlo en índices.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION bloquear_modificacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción (no se permite %)', TG_TABLE_NAME, TG_OP;
END $$;

-- ---------- 1. Usuarios y roles --------------------------------------
CREATE TABLE roles (
  id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      VARCHAR(30) NOT NULL UNIQUE,
  nombre      VARCHAR(60) NOT NULL,
  descripcion TEXT
);

CREATE TABLE usuarios (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username          VARCHAR(50)  NOT NULL,
  nombre_completo   VARCHAR(150) NOT NULL,
  email             VARCHAR(150),
  password_hash     TEXT         NOT NULL,
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  intentos_fallidos SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta   TIMESTAMPTZ,
  ultimo_login      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_usuarios_username ON usuarios (lower(username));
CREATE UNIQUE INDEX uq_usuarios_email    ON usuarios (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE usuarios_roles (
  usuario_id BIGINT   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id     SMALLINT NOT NULL REFERENCES roles(id),
  PRIMARY KEY (usuario_id, rol_id)
);
CREATE INDEX idx_usuarios_roles_rol ON usuarios_roles (rol_id);

-- Reservada para la siguiente iteración (refresh tokens con rotación).
CREATE TABLE refresh_tokens (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  BIGINT      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  CHAR(64)    NOT NULL UNIQUE,
  dispositivo VARCHAR(120),
  expira_en   TIMESTAMPTZ NOT NULL,
  revocado_en TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_usuario ON refresh_tokens (usuario_id);

-- ---------- 2. Catálogos ---------------------------------------------
CREATE TABLE autores (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_autores_nombre ON autores (lower(nombre));
CREATE INDEX idx_autores_nombre_trgm  ON autores USING gin (f_unaccent(lower(nombre)) gin_trgm_ops);

CREATE TABLE editoriales (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_editoriales_nombre ON editoriales (lower(nombre));

CREATE TABLE categorias (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL,
  padre_id   BIGINT REFERENCES categorias(id),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (padre_id IS NULL OR padre_id <> id)
);
CREATE UNIQUE INDEX uq_categorias_nombre ON categorias (lower(nombre), COALESCE(padre_id, 0));

CREATE TABLE ubicaciones (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      VARCHAR(40) NOT NULL UNIQUE,
  sede        VARCHAR(80),
  biblioteca  VARCHAR(80),
  seccion     VARCHAR(80),
  estante     VARCHAR(40),
  nivel       VARCHAR(20),
  aula        VARCHAR(40),
  almacen     VARCHAR(80),
  descripcion TEXT,
  activo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (COALESCE(biblioteca, aula, almacen) IS NOT NULL)
);

-- ---------- 3. Libros -------------------------------------------------
CREATE TABLE libros (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  isbn              VARCHAR(13),
  titulo            VARCHAR(300) NOT NULL,
  subtitulo         VARCHAR(300),
  editorial_id      BIGINT REFERENCES editoriales(id),
  anio_publicacion  SMALLINT,
  edicion           VARCHAR(60),
  categoria_id      BIGINT REFERENCES categorias(id),
  descripcion       TEXT,
  idioma            VARCHAR(10)  NOT NULL DEFAULT 'es',
  nivel_educativo   VARCHAR(20),
  grado_recomendado SMALLINT,
  imagen_url        TEXT,
  tipo_control      VARCHAR(12)  NOT NULL,
  prefijo_codigo    CHAR(3)      NOT NULL DEFAULT 'LIB',
  observaciones     TEXT,
  estado            VARCHAR(10)  NOT NULL DEFAULT 'ACTIVO',
  created_by        BIGINT REFERENCES usuarios(id),
  updated_by        BIGINT REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_libros_isbn    CHECK (isbn IS NULL OR isbn ~ '^([0-9]{13}|[0-9]{9}[0-9X])$'),
  CONSTRAINT ck_libros_tipo    CHECK (tipo_control IN ('CANTIDAD','INDIVIDUAL')),
  CONSTRAINT ck_libros_prefijo CHECK (prefijo_codigo IN ('LIB','ESP')),
  CONSTRAINT ck_libros_estado  CHECK (estado IN ('ACTIVO','ARCHIVADO')),
  CONSTRAINT ck_libros_nivel   CHECK (nivel_educativo IS NULL
                                      OR nivel_educativo IN ('INICIAL','PRIMARIA','SECUNDARIA','GENERAL')),
  CONSTRAINT ck_libros_grado   CHECK (grado_recomendado IS NULL OR grado_recomendado BETWEEN 1 AND 6),
  CONSTRAINT ck_libros_anio    CHECK (anio_publicacion IS NULL OR anio_publicacion BETWEEN 1400 AND 2100)
);
CREATE UNIQUE INDEX uq_libros_isbn ON libros (isbn) WHERE isbn IS NOT NULL;
CREATE INDEX idx_libros_titulo_trgm ON libros USING gin (f_unaccent(lower(titulo)) gin_trgm_ops);
CREATE INDEX idx_libros_editorial   ON libros (editorial_id);
CREATE INDEX idx_libros_categoria   ON libros (categoria_id);
CREATE INDEX idx_libros_filtros     ON libros (estado, tipo_control, nivel_educativo, grado_recomendado);

CREATE TABLE libros_autores (
  libro_id BIGINT   NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  autor_id BIGINT   NOT NULL REFERENCES autores(id),
  orden    SMALLINT NOT NULL DEFAULT 1,
  PRIMARY KEY (libro_id, autor_id)
);
CREATE INDEX idx_libros_autores_autor ON libros_autores (autor_id);

-- ---------- 4. Inventario --------------------------------------------
CREATE SEQUENCE seq_ejemplar_lib START 1;
CREATE SEQUENCE seq_ejemplar_esp START 1;

CREATE OR REPLACE FUNCTION generar_codigo_ejemplar(p_prefijo TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
BEGIN
  IF p_prefijo = 'LIB' THEN
    RETURN 'LIB-' || lpad(nextval('seq_ejemplar_lib')::text, 6, '0');
  ELSIF p_prefijo = 'ESP' THEN
    RETURN 'ESP-' || lpad(nextval('seq_ejemplar_esp')::text, 6, '0');
  END IF;
  RAISE EXCEPTION 'Prefijo de código no válido: %', p_prefijo;
END $$;

-- INDIVIDUAL: una fila por copia física
CREATE TABLE ejemplares (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  libro_id       BIGINT      NOT NULL REFERENCES libros(id),
  codigo_interno VARCHAR(20) NOT NULL UNIQUE,
  qr_generado_en TIMESTAMPTZ,
  estado         VARCHAR(12) NOT NULL DEFAULT 'DISPONIBLE',
  condicion      VARCHAR(12) NOT NULL DEFAULT 'BUENO',
  ubicacion_id   BIGINT REFERENCES ubicaciones(id),
  fecha_ingreso  DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_baja     DATE,
  observaciones  TEXT,
  created_by     BIGINT REFERENCES usuarios(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_ej_codigo    CHECK (codigo_interno ~ '^(LIB|ESP)-[0-9]{6,}$'),
  CONSTRAINT ck_ej_estado    CHECK (estado IN ('DISPONIBLE','PRESTADO','RESERVADO',
                                               'DANADO','PERDIDO','REPARACION','BAJA')),
  CONSTRAINT ck_ej_condicion CHECK (condicion IN ('NUEVO','BUENO','REGULAR','DETERIORADO')),
  CONSTRAINT ck_ej_baja      CHECK ((estado = 'BAJA') = (fecha_baja IS NOT NULL))
);
CREATE INDEX idx_ejemplares_libro     ON ejemplares (libro_id);
CREATE INDEX idx_ejemplares_estado    ON ejemplares (estado);
CREATE INDEX idx_ejemplares_ubicacion ON ejemplares (ubicacion_id);

-- CANTIDAD: stock agregado. Disponibles/prestados se CALCULAN (v_stock_libro).
CREATE TABLE existencias (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  libro_id         BIGINT  NOT NULL REFERENCES libros(id),
  ubicacion_id     BIGINT  REFERENCES ubicaciones(id),
  cantidad_total   INTEGER NOT NULL DEFAULT 0,
  cantidad_danada  INTEGER NOT NULL DEFAULT 0,
  cantidad_perdida INTEGER NOT NULL DEFAULT 0,
  cantidad_baja    INTEGER NOT NULL DEFAULT 0,
  observaciones    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_ex_no_negativos CHECK (cantidad_total >= 0 AND cantidad_danada >= 0
                                       AND cantidad_perdida >= 0 AND cantidad_baja >= 0),
  CONSTRAINT ck_ex_coherencia   CHECK (cantidad_danada + cantidad_perdida + cantidad_baja <= cantidad_total)
);
CREATE UNIQUE INDEX uq_existencias_libro_ubic ON existencias (libro_id, COALESCE(ubicacion_id, 0));

CREATE OR REPLACE FUNCTION validar_tipo_control() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_tipo TEXT; v_esperado TEXT;
BEGIN
  SELECT tipo_control INTO v_tipo FROM libros WHERE id = NEW.libro_id;
  v_esperado := CASE TG_TABLE_NAME WHEN 'ejemplares' THEN 'INDIVIDUAL' ELSE 'CANTIDAD' END;
  IF v_tipo IS DISTINCT FROM v_esperado THEN
    RAISE EXCEPTION 'El libro % tiene tipo de control %, no admite registros en %',
      NEW.libro_id, v_tipo, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ejemplares_tipo BEFORE INSERT OR UPDATE OF libro_id ON ejemplares
  FOR EACH ROW EXECUTE FUNCTION validar_tipo_control();
CREATE TRIGGER trg_existencias_tipo BEFORE INSERT OR UPDATE OF libro_id ON existencias
  FOR EACH ROW EXECUTE FUNCTION validar_tipo_control();

-- ---------- 5. Personas ----------------------------------------------
CREATE TABLE alumnos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_alumno   VARCHAR(30) NOT NULL UNIQUE,
  dni             VARCHAR(15) UNIQUE,
  nombres         VARCHAR(100) NOT NULL,
  apellidos       VARCHAR(100) NOT NULL,
  nivel_educativo VARCHAR(20),
  grado           SMALLINT,
  seccion         VARCHAR(5),
  telefono        VARCHAR(30),
  correo          VARCHAR(150),
  estado          VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
  fecha_registro  DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (estado IN ('ACTIVO','INACTIVO','RETIRADO')),
  CHECK (nivel_educativo IS NULL OR nivel_educativo IN ('INICIAL','PRIMARIA','SECUNDARIA')),
  CHECK (grado IS NULL OR grado BETWEEN 1 AND 6)
);
CREATE INDEX idx_alumnos_grado_sec ON alumnos (nivel_educativo, grado, seccion);
CREATE INDEX idx_alumnos_nombre_trgm ON alumnos
  USING gin (f_unaccent(lower(apellidos || ' ' || nombres)) gin_trgm_ops);

CREATE TABLE profesores (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dni        VARCHAR(15) UNIQUE,
  nombres    VARCHAR(100) NOT NULL,
  apellidos  VARCHAR(100) NOT NULL,
  correo     VARCHAR(150),
  telefono   VARCHAR(30),
  area       VARCHAR(100),
  estado     VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (estado IN ('ACTIVO','INACTIVO'))
);

-- ---------- 6. Préstamos ---------------------------------------------
CREATE TABLE prestamos (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id                BIGINT NOT NULL REFERENCES usuarios(id),
  tipo_prestatario          VARCHAR(10) NOT NULL,
  alumno_id                 BIGINT REFERENCES alumnos(id),
  profesor_id               BIGINT REFERENCES profesores(id),
  fecha_prestamo            TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_prevista_devolucion DATE        NOT NULL,
  fecha_cierre              TIMESTAMPTZ,
  estado                    VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
  observaciones             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (estado IN ('ACTIVO','CERRADO','ANULADO')),
  CHECK (
    (tipo_prestatario = 'ALUMNO'   AND alumno_id   IS NOT NULL AND profesor_id IS NULL) OR
    (tipo_prestatario = 'PROFESOR' AND profesor_id IS NOT NULL AND alumno_id   IS NULL)
  ),
  CHECK (estado = 'ANULADO' OR ((estado = 'CERRADO') = (fecha_cierre IS NOT NULL)))
);
CREATE INDEX idx_prestamos_activos  ON prestamos (fecha_prevista_devolucion) WHERE estado = 'ACTIVO';
CREATE INDEX idx_prestamos_alumno   ON prestamos (alumno_id)   WHERE alumno_id   IS NOT NULL;
CREATE INDEX idx_prestamos_profesor ON prestamos (profesor_id) WHERE profesor_id IS NOT NULL;
CREATE INDEX idx_prestamos_fecha    ON prestamos (fecha_prestamo);

-- Un detalle = UNA unidad prestada.
CREATE TABLE prestamo_detalles (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prestamo_id              BIGINT NOT NULL REFERENCES prestamos(id),
  ejemplar_id              BIGINT REFERENCES ejemplares(id),
  existencia_id            BIGINT REFERENCES existencias(id),
  estado                   VARCHAR(10) NOT NULL DEFAULT 'PRESTADO',
  condicion_salida         VARCHAR(12),
  fecha_devolucion         TIMESTAMPTZ,
  resultado_devolucion     VARCHAR(12),
  usuario_devolucion_id    BIGINT REFERENCES usuarios(id),
  observaciones_devolucion TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((ejemplar_id IS NOT NULL) <> (existencia_id IS NOT NULL)),
  CHECK (estado IN ('PRESTADO','DEVUELTO','PERDIDO')),
  CHECK (condicion_salida IS NULL OR condicion_salida IN ('NUEVO','BUENO','REGULAR','DETERIORADO')),
  CHECK (resultado_devolucion IS NULL
         OR resultado_devolucion IN ('BUENO','DETERIORADO','DANADO','PERDIDO')),
  CHECK (
    (estado = 'PRESTADO' AND fecha_devolucion IS NULL AND resultado_devolucion IS NULL) OR
    (estado <> 'PRESTADO' AND fecha_devolucion IS NOT NULL AND resultado_devolucion IS NOT NULL)
  ),
  CHECK ((estado = 'PERDIDO') = (resultado_devolucion IS NOT DISTINCT FROM 'PERDIDO'))
);
CREATE UNIQUE INDEX uq_detalle_ejemplar_activo ON prestamo_detalles (ejemplar_id)
  WHERE estado = 'PRESTADO' AND ejemplar_id IS NOT NULL;
CREATE INDEX idx_detalle_prestamo ON prestamo_detalles (prestamo_id);
CREATE INDEX idx_detalle_ejemplar ON prestamo_detalles (ejemplar_id) WHERE ejemplar_id IS NOT NULL;
CREATE INDEX idx_detalle_existencia_activo ON prestamo_detalles (existencia_id)
  WHERE estado = 'PRESTADO' AND existencia_id IS NOT NULL;

-- ---------- 7. Historial (solo inserción) ----------------------------
CREATE TABLE historial_ejemplares (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ejemplar_id           BIGINT      NOT NULL REFERENCES ejemplares(id),
  tipo_evento           VARCHAR(25) NOT NULL,
  estado_anterior       VARCHAR(12),
  estado_nuevo          VARCHAR(12),
  condicion_anterior    VARCHAR(12),
  condicion_nueva       VARCHAR(12),
  ubicacion_anterior_id BIGINT REFERENCES ubicaciones(id),
  ubicacion_nueva_id    BIGINT REFERENCES ubicaciones(id),
  prestamo_detalle_id   BIGINT REFERENCES prestamo_detalles(id),
  usuario_id            BIGINT      NOT NULL REFERENCES usuarios(id),
  detalle               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tipo_evento IN ('REGISTRADO','PRESTADO','DEVUELTO','CAMBIO_ESTADO','CAMBIO_CONDICION',
                         'CAMBIO_UBICACION','QR_REGENERADO','OBSERVACION','BAJA'))
);
CREATE INDEX idx_hist_ejemplar ON historial_ejemplares (ejemplar_id, created_at DESC);
CREATE TRIGGER trg_hist_inmutable BEFORE UPDATE OR DELETE ON historial_ejemplares
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

CREATE TABLE movimientos_existencias (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  existencia_id       BIGINT      NOT NULL REFERENCES existencias(id),
  tipo_movimiento     VARCHAR(20) NOT NULL,
  cantidad            INTEGER     NOT NULL CHECK (cantidad > 0),
  prestamo_detalle_id BIGINT REFERENCES prestamo_detalles(id),
  usuario_id          BIGINT      NOT NULL REFERENCES usuarios(id),
  detalle             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tipo_movimiento IN ('INGRESO','PRESTAMO','DEVOLUCION','MARCADO_DANADO',
                             'MARCADO_PERDIDO','RECUPERADO','BAJA','AJUSTE'))
);
CREATE INDEX idx_mov_existencia ON movimientos_existencias (existencia_id, created_at DESC);
CREATE TRIGGER trg_mov_inmutable BEFORE UPDATE OR DELETE ON movimientos_existencias
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

-- ---------- 8. Imágenes, auditoría, configuración --------------------
CREATE TABLE imagenes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  libro_id    BIGINT REFERENCES libros(id),
  ejemplar_id BIGINT REFERENCES ejemplares(id),
  url         TEXT         NOT NULL,
  public_id   VARCHAR(255) NOT NULL UNIQUE,
  es_portada  BOOLEAN      NOT NULL DEFAULT FALSE,
  ancho       INTEGER,
  alto        INTEGER,
  formato     VARCHAR(10),
  bytes       INTEGER,
  subido_por  BIGINT REFERENCES usuarios(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK ((libro_id IS NOT NULL) OR (ejemplar_id IS NOT NULL))
);
CREATE INDEX idx_imagenes_libro    ON imagenes (libro_id)    WHERE libro_id    IS NOT NULL;
CREATE INDEX idx_imagenes_ejemplar ON imagenes (ejemplar_id) WHERE ejemplar_id IS NOT NULL;
CREATE UNIQUE INDEX uq_imagen_portada_libro ON imagenes (libro_id)
  WHERE es_portada AND libro_id IS NOT NULL AND ejemplar_id IS NULL;

CREATE TABLE auditoria (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id       BIGINT REFERENCES usuarios(id),
  usuario_username VARCHAR(50),
  accion           VARCHAR(50) NOT NULL,
  entidad          VARCHAR(40) NOT NULL,
  entidad_id       VARCHAR(40),
  datos_anteriores JSONB,
  datos_nuevos     JSONB,
  ip               INET,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aud_entidad ON auditoria (entidad, entidad_id);
CREATE INDEX idx_aud_usuario ON auditoria (usuario_id, created_at DESC);
CREATE INDEX idx_aud_fecha   ON auditoria (created_at DESC);
CREATE TRIGGER trg_aud_inmutable BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

CREATE TABLE configuracion (
  clave       VARCHAR(60) PRIMARY KEY,
  valor       JSONB       NOT NULL,
  descripcion TEXT,
  updated_by  BIGINT REFERENCES usuarios(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 9. Vista de stock (calculado, nunca almacenado) ----------
CREATE VIEW v_stock_libro AS
WITH ind AS (
  SELECT libro_id,
         COUNT(*) FILTER (WHERE estado <> 'BAJA')      AS total,
         COUNT(*) FILTER (WHERE estado = 'DISPONIBLE') AS disponibles,
         COUNT(*) FILTER (WHERE estado = 'PRESTADO')   AS prestados,
         COUNT(*) FILTER (WHERE estado = 'RESERVADO')  AS reservados,
         COUNT(*) FILTER (WHERE estado = 'DANADO')     AS danados,
         COUNT(*) FILTER (WHERE estado = 'PERDIDO')    AS perdidos,
         COUNT(*) FILTER (WHERE estado = 'REPARACION') AS en_reparacion
  FROM ejemplares GROUP BY libro_id
),
prest AS (
  SELECT existencia_id, COUNT(*) AS n
  FROM prestamo_detalles
  WHERE estado = 'PRESTADO' AND existencia_id IS NOT NULL
  GROUP BY existencia_id
),
cant AS (
  SELECT e.libro_id,
         SUM(e.cantidad_total - e.cantidad_baja)                                   AS total,
         SUM(e.cantidad_total - e.cantidad_baja - e.cantidad_danada
             - e.cantidad_perdida - COALESCE(p.n, 0))                              AS disponibles,
         SUM(COALESCE(p.n, 0))                                                     AS prestados,
         0::bigint                                                                 AS reservados,
         SUM(e.cantidad_danada)                                                    AS danados,
         SUM(e.cantidad_perdida)                                                   AS perdidos,
         0::bigint                                                                 AS en_reparacion
  FROM existencias e LEFT JOIN prest p ON p.existencia_id = e.id
  GROUP BY e.libro_id
)
SELECT l.id AS libro_id, l.tipo_control,
       COALESCE(i.total, c.total, 0)::int             AS total,
       COALESCE(i.disponibles, c.disponibles, 0)::int AS disponibles,
       COALESCE(i.prestados, c.prestados, 0)::int     AS prestados,
       COALESCE(i.reservados, c.reservados, 0)::int   AS reservados,
       COALESCE(i.danados, c.danados, 0)::int         AS danados,
       COALESCE(i.perdidos, c.perdidos, 0)::int       AS perdidos,
       COALESCE(i.en_reparacion, c.en_reparacion, 0)::int AS en_reparacion
FROM libros l
LEFT JOIN ind  i ON i.libro_id = l.id AND l.tipo_control = 'INDIVIDUAL'
LEFT JOIN cant c ON c.libro_id = l.id AND l.tipo_control = 'CANTIDAD';

-- ---------- 10. Triggers updated_at ----------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios','autores','editoriales','categorias','ubicaciones',
                           'libros','ejemplares','existencias','alumnos','profesores','prestamos']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

COMMIT;
