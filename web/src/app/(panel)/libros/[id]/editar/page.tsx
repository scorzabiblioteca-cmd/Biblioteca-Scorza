"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Field, Msg, PageTitle } from "@/components/ui";

type Libro = {
  id: number;
  isbn: string | null;
  titulo: string;
  subtitulo: string | null;
  autores: string | null;
  editorial: string | null;
  categoria: string | null;
  anioPublicacion: number | null;
  edicion: string | null;
  idioma: string;
  nivelEducativo: string | null;
  gradoRecomendado: number | null;
  descripcion: string | null;
  imagenUrl: string | null;
  observaciones: string | null;
};

type Formulario = {
  isbn: string;
  titulo: string;
  subtitulo: string;
  autor: string;
  editorial: string;
  categoria: string;
  anioPublicacion: string;
  edicion: string;
  idioma: string;
  nivelEducativo: string;
  gradoRecomendado: string;
  descripcion: string;
  imagenUrl: string;
  observaciones: string;
};

const VACIO: Formulario = {
  isbn: "", titulo: "", subtitulo: "", autor: "", editorial: "", categoria: "",
  anioPublicacion: "", edicion: "", idioma: "es", nivelEducativo: "", gradoRecomendado: "",
  descripcion: "", imagenUrl: "", observaciones: "",
};

export default function EditarLibro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [f, setF] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let vigente = true;
    api<Libro>(`/libros/${id}`)
      .then((libro) => {
        if (!vigente) return;
        setF({
          isbn: libro.isbn ?? "",
          titulo: libro.titulo,
          subtitulo: libro.subtitulo ?? "",
          autor: libro.autores ?? "",
          editorial: libro.editorial ?? "",
          categoria: libro.categoria ?? "",
          anioPublicacion: libro.anioPublicacion == null ? "" : String(libro.anioPublicacion),
          edicion: libro.edicion ?? "",
          idioma: libro.idioma ?? "es",
          nivelEducativo: libro.nivelEducativo ?? "",
          gradoRecomendado: libro.gradoRecomendado == null ? "" : String(libro.gradoRecomendado),
          descripcion: libro.descripcion ?? "",
          imagenUrl: libro.imagenUrl ?? "",
          observaciones: libro.observaciones ?? "",
        });
      })
      .catch((e: Error) => { if (vigente) { setErr(e.message); setErrorCarga(true); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id]);

  const set = (key: keyof Formulario) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF((actual) => ({ ...actual, [key]: e.target.value }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErr("");
    try {
      await api(`/libros/${id}`, {
        method: "PUT",
        json: { ...f, nivelEducativo: f.nivelEducativo || null },
      });
      router.push(`/libros/${id}`);
    } catch (x) {
      setErr((x as Error).message);
      setGuardando(false);
    }
  }

  if (cargando) return <p className="text-sm text-slate-500">Cargando información del libro…</p>;
  if (errorCarga) {
    return (
      <>
        <PageTitle action={<Link href={`/libros/${id}`} className="btn-ghost">Volver</Link>}>Editar libro</PageTitle>
        <Msg type="error">{err}</Msg>
      </>
    );
  }

  return (
    <>
      <PageTitle action={<Link href={`/libros/${id}`} className="btn-ghost">Cancelar</Link>}>Editar libro</PageTitle>
      <form onSubmit={guardar} className="card grid max-w-4xl gap-4 sm:grid-cols-2">
        <Field label="Título *"><input className="input" required maxLength={300} value={f.titulo} onChange={set("titulo")} /></Field>
        <Field label="ISBN"><input className="input" maxLength={20} value={f.isbn} onChange={set("isbn")} /></Field>
        <Field label="Subtítulo"><input className="input" maxLength={300} value={f.subtitulo} onChange={set("subtitulo")} /></Field>
        <Field label="Autor(es) — separados por coma"><input className="input" maxLength={400} value={f.autor} onChange={set("autor")} /></Field>
        <Field label="Editorial"><input className="input" maxLength={200} value={f.editorial} onChange={set("editorial")} /></Field>
        <Field label="Categoría"><input className="input" maxLength={120} value={f.categoria} onChange={set("categoria")} /></Field>
        <Field label="Año de publicación"><input className="input" type="number" min={1400} max={2100} value={f.anioPublicacion} onChange={set("anioPublicacion")} /></Field>
        <Field label="Edición"><input className="input" maxLength={60} value={f.edicion} onChange={set("edicion")} /></Field>
        <Field label="Idioma"><input className="input" maxLength={10} value={f.idioma} onChange={set("idioma")} /></Field>
        <Field label="Nivel educativo">
          <select className="input" value={f.nivelEducativo} onChange={set("nivelEducativo")}>
            <option value="">—</option><option value="INICIAL">Inicial</option><option value="PRIMARIA">Primaria</option>
            <option value="SECUNDARIA">Secundaria</option><option value="GENERAL">General</option>
          </select>
        </Field>
        <Field label="Grado recomendado (1–6)"><input className="input" type="number" min={1} max={6} value={f.gradoRecomendado} onChange={set("gradoRecomendado")} /></Field>
        <Field label="URL de portada"><input className="input" type="url" maxLength={500} value={f.imagenUrl} onChange={set("imagenUrl")} /></Field>
        <Field label="Descripción" className="sm:col-span-2"><textarea className="input" rows={3} maxLength={4000} value={f.descripcion} onChange={set("descripcion")} /></Field>
        <Field label="Observaciones" className="sm:col-span-2"><textarea className="input" rows={3} maxLength={2000} value={f.observaciones} onChange={set("observaciones")} /></Field>
        <div className="space-y-3 sm:col-span-2">
          <Msg type="error">{err}</Msg>
          <button className="btn" disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </form>
    </>
  );
}
