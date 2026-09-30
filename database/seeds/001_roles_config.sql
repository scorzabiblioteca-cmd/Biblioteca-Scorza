INSERT INTO roles (codigo, nombre, descripcion) VALUES
  ('ADMIN',        'Administrador', 'Acceso completo'),
  ('BIBLIOTECARIO','Bibliotecario', 'Libros, préstamos, devoluciones, alumnos, inventario y consultas'),
  ('PROFESOR',     'Profesor',      'Reservado para uso futuro'),
  ('ALUMNO',       'Alumno',        'Reservado para uso futuro')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('dias_prestamo_defecto',        '7',  'Días para la fecha prevista de devolución'),
  ('max_prestamos_activos_alumno', '3',  'Máximo de unidades prestadas a la vez por alumno'),
  ('nombre_institucion',           '"Colegio Scorza"', 'Se muestra en reportes y etiquetas QR')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO ubicaciones (codigo, sede, biblioteca, seccion, estante, nivel) VALUES
  ('PRINCIPAL-GENERAL', 'Sede central', 'Principal', 'General', 'G-01', '1')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO categorias (nombre)
SELECT x FROM (VALUES ('Literatura'),('Matemática'),('Ciencias'),('Historia'),('Texto escolar'),('Referencia')) v(x)
WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE lower(nombre) = lower(x));
