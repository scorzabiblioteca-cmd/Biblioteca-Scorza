"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Msg } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/auth/login", { json: f }); router.push("/dashboard"); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={enviar} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-brand-700">BiblioScorza</h1>
          <p className="text-sm text-slate-500">Ingresa con tu usuario de biblioteca</p>
        </div>
        <label className="block"><span className="label">Usuario</span>
          <input className="input" autoFocus autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></label>
        <label className="block"><span className="label">Contraseña</span>
          <input className="input" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
        <Msg type="error">{err}</Msg>
        <button className="btn w-full" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </main>
  );
}
