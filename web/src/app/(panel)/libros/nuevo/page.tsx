"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Field, Msg, PageTitle } from "@/components/ui";
import { normalizarIsbn } from "@/lib/isbn";

type Ubic = { id: number; codigo: string; descripcion: string | null };
type EstadoConsultaIsbn = "inactivo" | "buscando" | "encontrado" | "sin-resultados" | "no-disponible" | "invalido";
type LibroIsbn = {
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
};
type RespuestaIsbn = {
  existente: {
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
    idioma: string;
    imagenUrl: string | null;
  } | null;
  estadoConsulta: "encontrado" | "sin-resultados" | "no-disponible";
  libro: LibroIsbn | null;
};
const VACIO = {
  isbn: "", titulo: "", subtitulo: "", autor: "", editorial: "", categoria: "", anioPublicacion: "", edicion: "", descripcion: "",
  idioma: "es", nivelEducativo: "", gradoRecomendado: "", tipoControl: "CANTIDAD", prefijoCodigo: "LIB", cantidad: "1",
  ubicacionId: "", observaciones: "", imagenUrl: "",
};
type DatosFormularioLibro = typeof VACIO;

export default function NuevoLibro() {
  const router = useRouter();
  const [f, setF] = useState<DatosFormularioLibro>(VACIO);
  const isbnActual = useRef("");
  const consultasEnCurso = useRef(new Set<string>());
  const [ubis, setUbis] = useState<Ubic[]>([]);
  const [existente, setExistente] = useState<{ id: number; titulo: string } | null>(null);
  const [estadoIsbn, setEstadoIsbn] = useState<EstadoConsultaIsbn>("inactivo");
  const [paginasEncontradas, setPaginasEncontradas] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  useEffect(() => { api<Ubic[]>("/ubicaciones").then(setUbis).catch(() => {}); }, []);

  async function buscarIsbn() {
    const isbn = normalizarIsbn(isbnActual.current || f.isbn);
    if (!isbn) {
      if (isbnActual.current.trim() || f.isbn.trim()) setEstadoIsbn("invalido");
      return;
    }
    if (consultasEnCurso.current.has(isbn)) return;

    consultasEnCurso.current.add(isbn);
    setEstadoIsbn("buscando");
    setPaginasEncontradas(null);
    try {
      const resultado = await api<RespuestaIsbn>(`/libros/isbn/${encodeURIComponent(isbn)}`);
      if (normalizarIsbn(isbnActual.current || f.isbn) !== isbn) return;
      setExistente(resultado.existente);
      if (resultado.existente || resultado.libro) {
        const existenteLocal = resultado.existente;
        const libro = resultado.libro;
        setF((actual) => ({
          ...actual,
          isbn: libro?.isbn || existenteLocal?.isbn || actual.isbn,
          titulo: libro?.titulo || existenteLocal?.titulo || actual.titulo,
          subtitulo: libro?.subtitulo || existenteLocal?.subtitulo || actual.subtitulo,
          autor: libro?.autor || existenteLocal?.autores || actual.autor,
          editorial: libro?.editorial || existenteLocal?.editorial || actual.editorial,
          categoria: libro?.categoria || existenteLocal?.categoria || actual.categoria,
          anioPublicacion: String(libro?.anioPublicacion ?? existenteLocal?.anioPublicacion ?? actual.anioPublicacion),
          edicion: libro?.edicion || existenteLocal?.edicion || actual.edicion,
          descripcion: libro?.descripcion || existenteLocal?.descripcion || actual.descripcion,
          idioma: libro?.idioma || existenteLocal?.idioma || actual.idioma,
          imagenUrl: libro?.imagenUrl || existenteLocal?.imagenUrl || actual.imagenUrl,
        }));
        setPaginasEncontradas(libro?.numeroPaginas ?? null);
      }
      setEstadoIsbn(resultado.estadoConsulta);
    } catch {
      if (normalizarIsbn(isbnActual.current || f.isbn) === isbn) setEstadoIsbn("no-disponible");
    } finally {
      consultasEnCurso.current.delete(isbn);
    }
  }

  async function subirFoto(file: File) {
    setSubiendo(true); setErr("");
    try {
      const s = await api<{ cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string }>("/imagenes/firma", { method: "POST", json: {} });
      const fd = new FormData();
      fd.append("file", file); fd.append("api_key", s.apiKey); fd.append("timestamp", String(s.timestamp));
      fd.append("folder", s.folder); fd.append("signature", s.signature);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "No se pudo subir la imagen");
      setF((p) => ({ ...p, imagenUrl: j.secure_url }));
    } catch (x) { setErr((x as Error).message); }
    setSubiendo(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const l = await api<{ id: number }>("/libros", { json: { ...f, cantidad: f.cantidad === "" ? 1 : Number(f.cantidad) } });
      router.push(`/libros/${l.id}`);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  return (
    <>
      <PageTitle action={<Link href="/libros" className="btn-ghost">Volver</Link>}>Registrar libro</PageTitle>
      <form onSubmit={guardar} className="card grid max-w-4xl gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="libro-isbn" className="label">ISBN (10 o 13 dígitos)</label>
          <div className="flex gap-2">
            <input id="libro-isbn" className="input min-w-0 flex-1" value={f.isbn} onChange={(e) => {
              isbnActual.current = e.target.value;
              setF((actual) => ({ ...actual, isbn: e.target.value }));
              setExistente(null); setEstadoIsbn("inactivo"); setPaginasEncontradas(null);
            }} onBlur={buscarIsbn} onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void buscarIsbn(); }
            }} inputMode="numeric" />
            <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => void buscarIsbn()}>🔍 Buscar ISBN</button>
          </div>
          {estadoIsbn === "buscando" && <p role="status" className="mt-1 text-xs text-slate-500">Buscando libro...</p>}
          {estadoIsbn === "encontrado" && <p role="status" className="mt-1 text-xs text-emerald-700">✓ Información encontrada{paginasEncontradas ? ` · ${paginasEncontradas} páginas` : ""}</p>}
          {estadoIsbn === "sin-resultados" && <p role="status" className="mt-1 text-xs text-amber-700">No se encontró información para este ISBN.</p>}
          {estadoIsbn === "no-disponible" && <p role="status" className="mt-1 text-xs text-amber-700">No se pudo consultar Google Books. Puedes ingresar los datos manualmente.</p>}
          {estadoIsbn === "invalido" && <p role="status" className="mt-1 text-xs text-amber-700">Ingresa un ISBN-10 o ISBN-13 válido.</p>}
          {existente && <span className="mt-1 block text-xs text-amber-700">Ya existe: <Link className="underline" href={`/libros/${existente.id}`}>{existente.titulo?.trim() || `ISBN ${f.isbn}`}</Link>. Agrega ejemplares desde ahí.</span>}
        </div>
        <Field label="Título *"><input className="input" required value={f.titulo} onChange={set("titulo")} /></Field>
        <Field label="Subtítulo"><input className="input" value={f.subtitulo} onChange={set("subtitulo")} /></Field>
        <Field label="Autor(es) — separa con coma"><input className="input" value={f.autor} onChange={set("autor")} /></Field>
        <Field label="Editorial"><input className="input" value={f.editorial} onChange={set("editorial")} /></Field>
        <Field label="Categoría"><input className="input" value={f.categoria} onChange={set("categoria")} list="cats" /></Field>
        <Field label="Año de publicación"><input className="input" type="number" value={f.anioPublicacion} onChange={set("anioPublicacion")} /></Field>
        <Field label="Edición"><input className="input" value={f.edicion} onChange={set("edicion")} /></Field>
        <Field label="Idioma"><input className="input" value={f.idioma} onChange={set("idioma")} /></Field>
        <Field label="Nivel educativo">
          <select className="input" value={f.nivelEducativo} onChange={set("nivelEducativo")}>
            <option value="">—</option><option value="INICIAL">Inicial</option><option value="PRIMARIA">Primaria</option>
            <option value="SECUNDARIA">Secundaria</option><option value="GENERAL">General</option>
          </select>
        </Field>
        <Field label="Grado recomendado (1–6)"><input className="input" type="number" min={1} max={6} value={f.gradoRecomendado} onChange={set("gradoRecomendado")} /></Field>
        <Field label="Tipo de control">
          <select className="input" value={f.tipoControl} onChange={set("tipoControl")}>
            <option value="CANTIDAD">Por cantidad (textos comunes)</option><option value="INDIVIDUAL">Individual (con QR por ejemplar)</option>
          </select>
        </Field>
        {f.tipoControl === "INDIVIDUAL" && (
          <Field label="Prefijo del código">
            <select className="input" value={f.prefijoCodigo} onChange={set("prefijoCodigo")}>
              <option value="LIB">LIB — libro común</option><option value="ESP">ESP — libro especial</option>
            </select>
          </Field>
        )}
        <Field label={f.tipoControl === "INDIVIDUAL" ? "Ejemplares a crear ahora" : "Cantidad total"}>
          <input className="input" type="number" min={0} value={f.cantidad} onChange={set("cantidad")} />
        </Field>
        <Field label="Ubicación">
          <select className="input" value={f.ubicacionId} onChange={set("ubicacionId")}>
            <option value="">Sin ubicación</option>
            {ubis.map((u) => <option key={u.id} value={u.id}>{u.codigo}{u.descripcion ? ` — ${u.descripcion}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Descripción" className="sm:col-span-2"><textarea className="input" rows={2} value={f.descripcion} onChange={set("descripcion")} /></Field>
        <Field label="Observaciones" className="sm:col-span-2"><textarea className="input" rows={2} value={f.observaciones} onChange={set("observaciones")} /></Field>
        <div className="sm:col-span-2">
          <span className="label">Fotografía de portada</span>
          <div className="flex items-center gap-3">
            {f.imagenUrl && <img src={f.imagenUrl} alt="Portada" className="h-20 w-14 rounded object-cover" />}
            <input type="file" accept="image/*" capture="environment" disabled={subiendo} onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} className="text-sm" />
            {subiendo && <span className="text-sm text-slate-500">Subiendo…</span>}
          </div>
        </div>
        <div className="space-y-3 sm:col-span-2">
          <Msg type="error">{err}</Msg>
          <button className="btn" disabled={busy || subiendo}>{busy ? "Guardando…" : "Guardar libro"}</button>
        </div>
      </form>
    </>
  );
}
