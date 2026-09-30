/** Texto legible de una ubicación (alias u = ubicaciones). */
export const UBIC_TXT = `NULLIF(concat_ws(' / ', u.sede, u.biblioteca, u.seccion,
  CASE WHEN u.estante IS NOT NULL THEN 'Estante ' || u.estante END,
  CASE WHEN u.nivel   IS NOT NULL THEN 'Nivel '   || u.nivel   END,
  u.aula, u.almacen), '')`;

export const norm = (expr: string) => `f_unaccent(lower(${expr}))`;
