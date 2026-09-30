# BiblioScorza — Sistema de Gestión de Biblioteca Escolar

Panel web (Next.js) + app Android (Java) sobre **una sola API** y **una sola base Neon PostgreSQL**. Imágenes en Cloudinary.

```
Android (Java, Retrofit) ──Bearer──▶ ┐
                                     ├─▶ Next.js /api (REST + JWT) ──▶ Neon PostgreSQL
Next.js Web ───────cookie httpOnly─▶ ┘
Android / Web ──(firma del servidor)──▶ Cloudinary  (en la BD solo se guarda la URL)
```

## Carpetas
| Carpeta | Contenido |
|---|---|
| `database/` | `schema.sql`, `seeds/`, `migrations/` |
| `web/` | Panel Next.js + API (Route Handlers) |
| `android/` | Proyecto Android Studio (Java + XML) |
| `documentacion/` | Instalación, API, permisos |

## Estado de esta versión (0.1 — funciones básicas)
Implementado y **probado contra PostgreSQL real** (API): login, roles, libros (CANTIDAD e INDIVIDUAL), búsqueda, ISBN,
ejemplares con códigos `LIB-/ESP-` únicos, QR, historial, alumnos, profesores (API), préstamos, devoluciones,
límite de préstamos, dashboard, 14 reportes (JSON/CSV), firma Cloudinary, auditoría.
El panel web compila y pasa `tsc`. **La app Android no se pudo compilar en el entorno de generación**: ábrela en Android Studio y
repórtame cualquier error de compilación para corregirlo.

Pendiente (siguientes fases): PDF/Excel nativo, CRUD web de profesores/autores/editoriales/categorías/ubicaciones/usuarios,
refresh tokens, edición de libros en web/Android, devolución por ISBN en Android para libros por cantidad, importación CSV de alumnos.

Instalación paso a paso: `documentacion/instalacion.md`.
