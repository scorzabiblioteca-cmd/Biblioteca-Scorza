# Arquitectura y decisiones
- **SQL directo** con `pg` + Zod (sin ORM): `database/schema.sql` es la fuente de verdad. Consultas siempre parametrizadas.
- **CANTIDAD** → tabla `existencias` (libro+ubicación+total); **INDIVIDUAL** → una fila por copia en `ejemplares`. Disponibles/prestados se **calculan** (vista `v_stock_libro`).
- Un detalle de préstamo = una unidad. Índice único parcial impide dos préstamos activos del mismo ejemplar; `SELECT … FOR UPDATE` evita carreras.
- `historial_ejemplares`, `movimientos_existencias` y `auditoria` son de solo inserción (trigger).
- Estado `DANADO` sin ñ en BD/API; la etiqueta visible es «Dañado».
- El QR no se guarda: se genera desde `codigo_interno`. `qr_generado_en` registra la última generación.
- JWT (12 h) firmado con `JWT_SECRET`; contraseñas con bcrypt (coste 12); bloqueo de 15 min tras 5 intentos fallidos.
  El usuario se revalida contra la BD en cada petición (un usuario desactivado pierde acceso de inmediato).
- Cloudinary: la app pide una firma al servidor y sube directo; el `API_SECRET` nunca sale del servidor.
- «Vencido» = préstamo activo con fecha prevista anterior a hoy en zona `America/Lima`.
- El ISBN se valida (dígito verificador) y se normaliza a ISBN-13. Un ISBN de ejemplo con dígito verificador incorrecto será rechazado.
