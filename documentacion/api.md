# API (resumen)
Respuesta OK: `{ "success": true, "data": …, "message": "…" }` · Error: `{ "success": false, "message": "…", "code": "…", "errors": {…} }`
Autenticación: `Authorization: Bearer <token>` (Android) o cookie `bs_token` (web). Roles: ADMIN (todo) y BIBLIOTECARIO.

| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/auth/login · /logout · GET /me | Sesión |
| GET/POST | /api/libros | Listar (`q, tipoControl, disponibilidad, categoriaId, editorialId, grado, anio, ubicacionId, estado, page, pageSize`) / crear |
| GET/PUT/PATCH | /api/libros/:id | Detalle / editar / archivar `{archivado:true}` |
| GET | /api/libros/isbn/:isbn | Buscar por ISBN (10 o 13; 404 si no existe) |
| POST | /api/libros/:id/ejemplares | Agregar N ejemplares (INDIVIDUAL) o sumar stock (CANTIDAD) |
| GET | /api/ejemplares · /:id · /codigo/:codigo · /:id/historial | Consultas |
| PATCH | /api/ejemplares/:id | Estado / condición / ubicación (audita) |
| GET/POST | /api/ejemplares/:id/qr | PNG (`?formato=svg`, `?descargar=1`) / regenerar |
| GET/POST | /api/alumnos (+ /dni/:dni, /codigo/:codigo) · /api/profesores · /api/ubicaciones | Personas y ubicaciones |
| GET/POST | /api/prestamos · GET /:id · /activo/ejemplar/:codigo | Préstamos (ítems por `codigoEjemplar` o `libroId`+`cantidad`) |
| POST | /api/devoluciones | `{codigoEjemplar | prestamoDetalleId, resultado: BUENO|DETERIORADO|DANADO|PERDIDO}` |
| GET | /api/dashboard/resumen · /api/reportes/:tipo (`?formato=csv`) | Estadísticas y reportes |
| POST | /api/imagenes/firma | Firma para subir directo a Cloudinary |

Códigos HTTP: 200, 201, 400 (validación), 401, 403, 404, 409 (duplicado/estado inválido), 500.
Reportes: inventario, disponibles, prestados, vencidos, danados, perdidos, mas-prestados, nunca-prestados, por-categoria,
por-grado, por-editorial, por-ubicacion, movimientos (`desde,hasta`), prestamos-alumno (`desde,hasta`).
