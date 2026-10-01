import { withAuth, ok, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { isbn10From13, normalizarIsbn } from "@/lib/isbn";
import { LIBRO_SELECT } from "@/lib/libros";

interface GoogleBooksVolumeInfo {
  title?: unknown;
  subtitle?: unknown;
  authors?: unknown;
  publisher?: unknown;
  publishedDate?: unknown;
  pageCount?: unknown;
  language?: unknown;
  imageLinks?: unknown;
  categories?: unknown;
  description?: unknown;
  industryIdentifiers?: unknown;
}

interface Libro {
  isbn: string;
  titulo: string;
  subtitulo?: string;
  autor?: string;
  editorial?: string;
  anioPublicacion?: number;
  edicion?: string;
  descripcion?: string;
  idioma?: string;
  imagenUrl?: string;
  categoria?: string;
  numeroPaginas?: number;
}

interface LibroRegistrado {
  id: number;
  isbn: string | null;
  titulo: string;
  subtitulo: string | null;
  autores: string | null;
  editorial: string | null;
  categoria: string | null;
  anioPublicacion: number | null;
  edicion: string | null;
  descripcion: string | null;
  idioma: string | null;
  imagenUrl: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value) && typeof value.value === "string" && value.value.trim()) return value.value.trim();
  return undefined;
}

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function publicationYear(value: unknown): number | undefined {
  const date = text(value);
  const year = date?.match(/\b\d{4}\b/)?.[0];
  const parsed = year ? Number(year) : NaN;
  return parsed >= 1400 && parsed <= 2100 ? parsed : undefined;
}

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const isbn = normalizarIsbn(params.isbn);
  if (!isbn) throw new HttpError(400, "El ISBN no es válido", "ISBN_INVALIDO");

  const isbn10 = isbn10From13(isbn);
  const existingQuery = `${LIBRO_SELECT} WHERE l.isbn = $1${isbn10 ? " OR l.isbn = $2" : ""} LIMIT 1`;
  const existente = await q1<LibroRegistrado>(pool, existingQuery, isbn10 ? [isbn, isbn10] : [isbn]);
  const existenteRespuesta = existente ? {
    id: existente.id,
    isbn: existente.isbn,
    titulo: existente.titulo,
    subtitulo: existente.subtitulo,
    autores: existente.autores,
    editorial: existente.editorial,
    categoria: existente.categoria,
    anioPublicacion: existente.anioPublicacion,
    edicion: existente.edicion,
    descripcion: existente.descripcion,
    idioma: existente.idioma,
    imagenUrl: existente.imagenUrl,
  } : null;
  if (existente) {
    const libro: Libro = {
      isbn,
      titulo: existente.titulo,
      ...(existente.subtitulo ? { subtitulo: existente.subtitulo } : {}),
      ...(existente.autores ? { autor: existente.autores } : {}),
      ...(existente.editorial ? { editorial: existente.editorial } : {}),
      ...(existente.categoria ? { categoria: existente.categoria } : {}),
      ...(existente.anioPublicacion ? { anioPublicacion: existente.anioPublicacion } : {}),
      ...(existente.edicion ? { edicion: existente.edicion } : {}),
      ...(existente.descripcion ? { descripcion: existente.descripcion } : {}),
      ...(existente.idioma ? { idioma: existente.idioma } : {}),
      ...(existente.imagenUrl ? { imagenUrl: existente.imagenUrl } : {}),
    };
    return ok({ existente: existenteRespuesta, estadoConsulta: "encontrado", libro });
  }

  try {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", `isbn:${isbn}`);
    url.searchParams.set("maxResults", "5");
    const headers = new Headers({ Accept: "application/json" });
    if (process.env.GOOGLE_BOOKS_API_KEY) headers.set("X-Goog-Api-Key", process.env.GOOGLE_BOOKS_API_KEY);
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return ok({ existente: existenteRespuesta, estadoConsulta: "no-disponible", libro: null });

    const payload: unknown = await response.json();
    const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items.filter(isRecord) : [];
    if (!items.length) {
      return ok({ existente: existenteRespuesta, estadoConsulta: "sin-resultados", libro: null });
    }

    const matchesIsbn = (item: Record<string, unknown>) => {
      const volumeInfo = isRecord(item.volumeInfo) ? item.volumeInfo : undefined;
      const identifiers = volumeInfo?.industryIdentifiers;
      return Array.isArray(identifiers) && identifiers.some((identifier) => {
        if (!isRecord(identifier)) return false;
        const value = text(identifier.identifier);
        return value ? normalizarIsbn(value) === isbn : false;
      });
    };
    const dataItem = items.find(matchesIsbn) ?? items.find((item) => {
      const volumeInfo = isRecord(item.volumeInfo) ? item.volumeInfo : undefined;
      return !Array.isArray(volumeInfo?.industryIdentifiers) && Boolean(text(volumeInfo?.title));
    });
    if (!dataItem || !isRecord(dataItem.volumeInfo)) {
      return ok({ existente: existenteRespuesta, estadoConsulta: "sin-resultados", libro: null });
    }

    const data = dataItem.volumeInfo as GoogleBooksVolumeInfo;
    const titulo = text(data.title);
    if (!titulo) return ok({ existente, estadoConsulta: "sin-resultados", libro: null });
    const autores = textList(data.authors);
    const categories = textList(data.categories);
    const imageLinks = isRecord(data.imageLinks) ? data.imageLinks : undefined;
    const imageUrl = text(imageLinks?.thumbnail) ?? text(imageLinks?.smallThumbnail);
    const year = publicationYear(data.publishedDate);
    const pages = typeof data.pageCount === "number" && data.pageCount > 0 ? data.pageCount : undefined;
    const libro: Libro = {
      isbn,
      titulo,
      ...(text(data.subtitle) ? { subtitulo: text(data.subtitle) } : {}),
      ...(autores.length ? { autor: autores.join(", ") } : {}),
      ...(text(data.publisher) ? { editorial: text(data.publisher) } : {}),
      ...(year ? { anioPublicacion: year } : {}),
      ...(text(data.description) ? { descripcion: text(data.description) } : {}),
      ...(text(data.language) ? { idioma: text(data.language) } : {}),
      ...(imageUrl ? { imagenUrl: imageUrl.replace(/^http:/i, "https:") } : {}),
      ...(categories[0] ? { categoria: categories[0] } : {}),
      ...(pages ? { numeroPaginas: pages } : {}),
    };
    return ok({ existente: existenteRespuesta, estadoConsulta: "encontrado", libro });
  } catch {
    return ok({ existente: existenteRespuesta, estadoConsulta: "no-disponible", libro: null });
  }
});
