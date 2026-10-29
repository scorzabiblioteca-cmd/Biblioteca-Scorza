const DESTINO = process.env.MAIL_TO || "scorzabiblioteca@gmail.com";
const REMITENTE = process.env.MAIL_FROM || "scorzabiblioteca@gmail.com";

let cache: { token: string; expira: number } | null = null;

async function accessToken() {
  if (cache && cache.expira > Date.now() + 60_000) return cache.token;

  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    throw new Error(
      "Gmail API no configurada: define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en .env.local"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `No se pudo obtener el token de Gmail: ${data.error_description || data.error || res.status}`
    );
  }

  cache = { token: data.access_token, expira: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));

const base64 = (s: string) => Buffer.from(s).toString("base64").replace(/.{1,76}/g, "$&\r\n");

function construirMime(datos: { asunto: string; texto: string; html: string }) {
  const limite = `biblioscorza-${Date.now().toString(36)}`;
  return [
    `From: BiblioScorza <${REMITENTE}>`,
    `To: ${DESTINO}`,
    `Subject: =?UTF-8?B?${Buffer.from(datos.asunto).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    "",
    `--${limite}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(datos.texto),
    `--${limite}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(datos.html),
    `--${limite}--`,
    "",
  ].join("\r\n");
}

async function enviarConToken(token: string, raw: string) {
  return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
}

export async function enviarCodigoRecuperacion(datos: {
  username: string;
  codigo: string;
  minutos: number;
}) {
  const { username, codigo, minutos } = datos;
  const usuario = escapar(username);
  const asunto = `Código de recuperación para ${username}`;

  const texto = [
    "Solicitud de recuperación de contraseña · BiblioScorza",
    "",
    `Usuario: ${username}`,
    `Código: ${codigo}`,
    `Vigencia: ${minutos} minutos`,
    "",
    "Entrega este código únicamente a la persona que lo solicitó.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#172b4d">
      <h2 style="margin:0 0 8px">Recuperación de contraseña</h2>
      <p style="margin:0 0 16px;color:#718096">Solicitud de recuperación · BiblioScorza</p>
      <p style="margin:0 0 8px"><strong>Usuario:</strong> ${usuario}</p>
      <p style="margin:0 0 16px">Código de verificación:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;padding:16px;text-align:center;background:#f1f5fb;border-radius:10px">${codigo}</p>
      <p style="margin:0 0 16px;color:#718096">Vigencia: ${minutos} minutos.</p>
      <p style="margin:0;color:#718096;font-size:13px">Entrega este código únicamente a la persona que lo solicitó.</p>
    </div>
  `;

  const raw = Buffer.from(construirMime({ asunto, texto, html })).toString("base64url");

  let res = await enviarConToken(await accessToken(), raw);
  if (res.status === 401) {
    cache = null;
    res = await enviarConToken(await accessToken(), raw);
  }
  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Gmail API respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }
}
