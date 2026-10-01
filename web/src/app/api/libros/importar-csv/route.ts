import { parse } from "csv-parse/sync";
import { withAuth, ok, HttpError } from "@/lib/http";
import { q1, tx, pool } from "@/lib/db";
import { audit } from "@/lib/audit";
import { agregarUnidades, getOrCreate, setAutores } from "@/lib/libros";
import { libroSchema } from "@/lib/validators";
import { isbn10From13, normalizarIsbn } from "@/lib/isbn";
import { UBIC_TXT, norm } from "@/lib/sql";

type CsvRow = Record<string, string>;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1000;

function headerKey(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();
}

function field(row: CsvRow, ...names: string[]) {
  for (const name of names) {
    const value = row[headerKey(name)];
    if (value !== undefined && value.trim()) return value.trim();
  }
  return "";
}

function findHeaderIndex(lines: string[]) {
  return lines.findIndex((line) => {
    const compact = headerKey(line);
    return compact.includes("titulodellibro") || /(^|[,;\t])\s*"?titulo"?\s*([,;\t]|$)/i.test(line);
  });
}

function normalizeCondition(value: string) {
  const condition = headerKey(value).toUpperCase();
  if (condition === "NUEVO") return "NUEVO";
  if (condition === "BUENO") return "BUENO";
  if (condition === "REGULAR") return "REGULAR";
  if (condition === "MALO" || condition === "DETERIORADO") return "DETERIORADO";
  return value || "BUENO";
}

async function findLocationId(value: string) {
  const shelf = value.match(/^estante\s+(.+)$/i)?.[1]?.trim();
  const params = shelf ? [value, shelf] : [value];
  const shelfClause = shelf ? ` OR ${norm("COALESCE(u.estante, '')")} = ${norm("$2")}` : "";
  const matches = await q1<{ id: number; ambiguous: boolean }>(
    pool,
    `SELECT min(u.id)::int AS id, count(*) > 1 AS ambiguous FROM ubicaciones u
     WHERE u.activo AND (${norm("u.codigo")} = ${norm("$1")} OR ${norm(UBIC_TXT)} = ${norm("$1")}${shelfClause})
     HAVING count(*) > 0`,
    params
  );
  if (!matches) return { id: null, ambiguous: false };
  return { id: matches.id, ambiguous: matches.ambiguous };
}

export const POST = withAuth(["BIBLIOTECARIO"], async (req, { session }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Selecciona un archivo CSV");
  if (!file.name.toLowerCase().endsWith(".csv")) throw new HttpError(400, "El archivo debe tener extensión .csv");
  if (!file.size || file.size > MAX_FILE_SIZE) throw new HttpError(400, "El archivo debe pesar entre 1 byte y 5 MB");

  let headers: string[] = [];
  let records: CsvRow[];
  try {
    const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
    const firstLine = lines[0]?.trim();
    const separatorDirective = firstLine?.match(/^sep=(,|;|\t)$/i);
    const headerIndex = findHeaderIndex(lines);
    if (headerIndex < 0) throw new HttpError(400, "No se encontró una columna de título en el CSV");
    const delimiter = separatorDirective?.[1] ?? [",", ";", "\t"].sort((left, right) =>
      (lines[headerIndex].split(right).length - 1) - (lines[headerIndex].split(left).length - 1)
    )[0];
    const content = lines.slice(headerIndex).map((line) => {
      if (/^"[A-Z]{2,}\d+,\d{2}\/\d{2}\/\d{4}.*"$/i.test(line)) {
        return line.slice(1, -1).replace(/""/g, '"');
      }
      return line;
    }).join("\n");
    records = parse(content, {
      bom: true,
      columns: (inputHeaders: string[]) => {
        headers = inputHeaders.map(headerKey);
        return headers;
      },
      delimiter,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (error) {
    const parseError = error as { code?: string; lines?: number };
    const reason = parseError.code === "CSV_RECORD_INCONSISTENT_COLUMNS"
      ? "Las filas tienen distinto número de columnas."
      : parseError.code?.includes("QUOTE")
        ? "Hay comillas sin cerrar o escapadas incorrectamente."
        : "Revisa el separador y las comillas del archivo.";
    const line = parseError.lines ? ` Línea aproximada: ${parseError.lines}.` : "";
    throw new HttpError(400, `El CSV no tiene un formato válido. ${reason}${line}`);
  }

  if (!headers.some((header) => ["titulo", "title", "titulodellibro"].includes(header))) {
    throw new HttpError(400, "El CSV debe incluir una columna de título");
  }
  if (!records.length) throw new HttpError(400, "El CSV no contiene filas para importar");
  if (records.length > MAX_ROWS) throw new HttpError(400, `El CSV supera el máximo de ${MAX_ROWS} filas`);

  let importados = 0;
  let duplicados = 0;
  const errores: { fila: number; mensaje: string }[] = [];
  const advertencias: { fila: number; mensaje: string }[] = [];
  const isbnsProcesados = new Set<string>();

  for (const [index, row] of records.entries()) {
    const fila = index + 2;
    const isbnOriginal = field(row, "isbn");
    const isbn = isbnOriginal ? normalizarIsbn(isbnOriginal) : null;
    if (isbnOriginal && !isbn) {
      errores.push({ fila, mensaje: "El ISBN no es válido" });
      continue;
    }

    const locationText = field(row, "ubicacion", "location");
    const directLocationId = field(row, "ubicacionId", "ubicacion_id");
    let locationId = directLocationId;
    if (!locationId && locationText) {
      try {
        const location = await findLocationId(locationText);
        if (!location.id || location.ambiguous) {
          advertencias.push({ fila, mensaje: location.ambiguous
            ? `Se importará sin ubicación: "${locationText}" coincide con más de una ubicación`
            : `Se importará sin ubicación: no existe "${locationText}" en el catálogo` });
        } else {
          locationId = String(location.id);
        }
      } catch {
        advertencias.push({ fila, mensaje: `Se importará sin ubicación: no se pudo validar "${locationText}"` });
      }
    }

    const parsed = libroSchema.safeParse({
      isbn,
      titulo: field(row, "titulo", "title", "titulodellibro"),
      subtitulo: field(row, "subtitulo"),
      autor: field(row, "autor", "autores"),
      editorial: field(row, "editorial"),
      categoria: field(row, "categoria"),
      anioPublicacion: field(row, "anioPublicacion", "anio_publicacion", "añoPublicacion", "año", "year"),
      edicion: field(row, "edicion"),
      descripcion: field(row, "descripcion"),
      idioma: field(row, "idioma") || "es",
      nivelEducativo: field(row, "nivelEducativo", "nivel_educativo") || null,
      gradoRecomendado: field(row, "gradoRecomendado", "grado_recomendado"),
      imagenUrl: field(row, "imagenUrl", "imagen_url") || null,
      tipoControl: field(row, "tipoControl", "tipo_control") || "CANTIDAD",
      prefijoCodigo: field(row, "prefijoCodigo", "prefijo_codigo") || "LIB",
      cantidad: field(row, "cantidad", "total", "cantidaddeejemplares") || "1",
      ubicacionId: locationId,
      condicion: normalizeCondition(field(row, "condicion", "estad libro", "estadoLibro", "estado libro")),
      observaciones: field(row, "observaciones"),
    });
    if (!parsed.success) {
      errores.push({ fila, mensaje: parsed.error.issues.map((issue) => issue.message).join("; ") });
      continue;
    }

    const data = parsed.data;
    try {
      if (data.isbn) {
        if (isbnsProcesados.has(data.isbn)) {
          duplicados++;
          continue;
        }
        isbnsProcesados.add(data.isbn);
        const isbn10 = isbn10From13(data.isbn);
        const duplicado = await q1<{ id: number }>(
          pool,
          `SELECT id FROM libros WHERE isbn = $1${isbn10 ? " OR isbn = $2" : ""} LIMIT 1`,
          isbn10 ? [data.isbn, isbn10] : [data.isbn]
        );
        if (duplicado) {
          duplicados++;
          continue;
        }
      }

      await tx(async (client) => {
        const editorialId = data.editorial ? await getOrCreate(client, "editoriales", data.editorial) : null;
        const categoriaId = data.categoria ? await getOrCreate(client, "categorias", data.categoria) : null;
        const libro = await q1<{ id: number }>(
          client,
          `INSERT INTO libros (isbn, titulo, subtitulo, editorial_id, anio_publicacion, edicion, categoria_id, descripcion,
             idioma, nivel_educativo, grado_recomendado, imagen_url, tipo_control, prefijo_codigo, observaciones, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING id`,
          [data.isbn, data.titulo, data.subtitulo, editorialId, data.anioPublicacion ?? null, data.edicion, categoriaId,
            data.descripcion, data.idioma, data.nivelEducativo ?? null, data.gradoRecomendado ?? null, data.imagenUrl ?? null,
            data.tipoControl, data.prefijoCodigo, data.observaciones, session.id]
        );
        await setAutores(client, libro!.id, data.autor);
        await agregarUnidades(client, { id: libro!.id, tipoControl: data.tipoControl, prefijoCodigo: data.prefijoCodigo },
          data.cantidad ?? 1, data.ubicacionId ?? null, data.condicion, session.id);
        await audit(client, session, "IMPORTAR_LIBRO_CSV", "libros", libro!.id, null,
          { isbn: data.isbn, titulo: data.titulo, cantidad: data.cantidad ?? 1 }, req);
      });
      importados++;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") duplicados++;
      else errores.push({ fila, mensaje: "No se pudo guardar el libro" });
    }
  }

  return ok({ total: records.length, importados, duplicados, errores, advertencias });
});