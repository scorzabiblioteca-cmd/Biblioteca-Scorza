import { z } from "zod";

const str = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(min).max(max).optional()
  );

export const ESTADOS_EJEMPLAR = ["DISPONIBLE", "PRESTADO", "RESERVADO", "DANADO", "PERDIDO", "REPARACION", "BAJA"] as const;
export const CONDICIONES = ["NUEVO", "BUENO", "REGULAR", "DETERIORADO"] as const;

export const libroSchema = z.object({
  isbn: str(20),
  titulo: z.string().trim().min(1, "El título es obligatorio").max(300),
  subtitulo: str(300),
  autor: str(400),
  editorial: str(200),
  categoria: str(120),
  anioPublicacion: optInt(1400, 2100),
  edicion: str(60),
  descripcion: str(4000),
  idioma: z.string().trim().max(10).default("es"),
  nivelEducativo: z.enum(["INICIAL", "PRIMARIA", "SECUNDARIA", "GENERAL"]).optional().nullable(),
  gradoRecomendado: optInt(1, 6),
  imagenUrl: z.string().url().max(500).optional().nullable().or(z.literal("").transform(() => null)),
  tipoControl: z.enum(["CANTIDAD", "INDIVIDUAL"]),
  prefijoCodigo: z.enum(["LIB", "ESP"]).default("LIB"),
  cantidad: optInt(0, 100000),
  ubicacionId: optInt(1, 2_000_000_000),
  condicion: z.enum(CONDICIONES).default("BUENO"),
  observaciones: str(2000),
});

export const alumnoSchema = z.object({
  codigoAlumno: z.string().trim().min(1, "El código es obligatorio").max(30),
  dni: str(15),
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  nivelEducativo: z.enum(["INICIAL", "PRIMARIA", "SECUNDARIA"]).optional().nullable(),
  grado: optInt(1, 6),
  seccion: str(5),
  telefono: str(30),
  correo: z.string().email().max(150).optional().nullable().or(z.literal("").transform(() => null)),
});

export const profesorSchema = z.object({
  dni: str(15),
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  correo: z.string().email().max(150).optional().nullable().or(z.literal("").transform(() => null)),
  telefono: str(30),
  area: str(100),
});

export const ubicacionSchema = z.object({
  codigo: z.string().trim().min(1).max(40),
  sede: str(80), biblioteca: str(80), seccion: str(80), estante: str(40),
  nivel: str(20), aula: str(40), almacen: str(80),
});

export const prestamoSchema = z.object({
  alumnoId: optInt(1, 2_000_000_000),
  alumnoDni: z.string().trim().max(15).optional(),
  alumnoCodigo: z.string().trim().max(30).optional(),
  profesorId: optInt(1, 2_000_000_000),
  diasPrestamo: optInt(1, 365),
  observaciones: str(1000),
  items: z
    .array(
      z.object({
        codigoEjemplar: z.string().trim().max(20).optional(),
        libroId: optInt(1, 2_000_000_000),
        ubicacionId: optInt(1, 2_000_000_000),
        cantidad: optInt(1, 100),
      })
    )
    .min(1, "Agrega al menos un libro")
    .max(20),
});

export const devolucionSchema = z.object({
  codigoEjemplar: z.string().trim().max(20).optional(),
  prestamoDetalleId: optInt(1, 2_000_000_000_000),
  resultado: z.enum(["BUENO", "DETERIORADO", "DANADO", "PERDIDO"]),
  observaciones: str(1000),
});

export const ejemplarPatchSchema = z.object({
  estado: z.enum(ESTADOS_EJEMPLAR).optional(),
  condicion: z.enum(CONDICIONES).optional(),
  ubicacionId: optInt(1, 2_000_000_000),
  observaciones: str(2000),
});
