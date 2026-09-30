# Permisos
| Recurso | ADMIN | BIBLIOTECARIO |
|---|---|---|
| Libros, ejemplares, alumnos, profesores, préstamos, devoluciones, reportes, dashboard | ✔ | ✔ |
| Usuarios, auditoría, configuración (siguientes fases) | ✔ | ✘ |
`withAuth([...roles], handler)` protege cada endpoint; ADMIN siempre pasa. Para añadir PROFESOR/ALUMNO basta crear rutas con su rol.
