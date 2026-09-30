"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Field, Msg, PageTitle } from "@/components/ui";

type Ubic = { id: number; codigo: string; descripcion: string | null };
const VACIO = {
  isbn: "", titulo: "", subtitulo: "", autor: "", editorial: "", categoria: "", anioPublicacion: "", edicion: "", descripcion: "",
  idioma: "es", nivelEducativo: "", gradoRecomendado: "", tipoControl: "CANTIDAD", prefijoCodigo: "LIB", cantidad: "1",
  ubicacionId: "", observaciones: "", imagenUrl: "",
};

export default function NuevoLibro() {
  const router = useRouter();
  const [f, setF] = useState(VACIO);
  const [ubis, setUbis] = useState<Ubic[]>([]);
  const [existente, setExistente] = useState<{ id: number; titulo: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  useEffect(() => { api<Ubic[]>("/ubicaciones").then(setUbis).catch(() => {}); }, []);

  async function revisarIsbn() {
    setExistente(null);
    if (!f.isbn.trim()) return;
    try { const l = await api<{ id: number; titulo: string }>(`/libros/isbn/${encodeURIComponent(f.isbn.trim())}`); setExistente(l); }
    catch { /* no existe: es lo esperado */ }
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
        <Field label="ISBN (10 o 13 dígitos)">
          <input className="input" value={f.isbn} onChange={set("isbn")} onBlur={revisarIsbn} inputMode="numeric" />
          {existente && <span className="mt-1 block text-xs text-amber-700">Ya existe: <Link className="underline" href={`/libros/${existente.id}`}>{existente.titulo}</Link>. Agrega ejemplares desde ahí.</span>}
        </Field>
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
