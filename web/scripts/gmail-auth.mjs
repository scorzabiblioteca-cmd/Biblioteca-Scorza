// Genera el GOOGLE_REFRESH_TOKEN para enviar correos con la Gmail API.
// Requiere un cliente OAuth 2.0 de tipo "App de escritorio" en Google Cloud.
// Uso: npm run gmail:auth

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";

const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en web/.env.local");
  process.exit(1);
}

const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/gmail.send";
const CUENTA = process.env.MAIL_FROM || "scorzabiblioteca@gmail.com";

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    login_hint: CUENTA,
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/") {
    res.writeHead(404).end();
    return;
  }

  const error = url.searchParams.get("error");
  if (error) {
    console.error("Autorización cancelada:", error);
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end(`Autorización cancelada: ${error}`);
    server.close();
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Falta el código de autorización.");
    return;
  }

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.refresh_token) {
      console.error("No se obtuvo el refresh token:", data);
      res
        .writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
        .end("No se obtuvo el refresh token. Revisa la consola.");
      return;
    }

    const destino = path.resolve(import.meta.dirname, "..", ".env.local");
    const contenido = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : "";
    const linea = `GOOGLE_REFRESH_TOKEN=${data.refresh_token}`;
    const actualizado = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(contenido)
      ? contenido.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, linea)
      : `${contenido.replace(/\s*$/, "")}\n${linea}\n`;
    fs.writeFileSync(destino, actualizado, "utf8");

    console.log(`\n✓ GOOGLE_REFRESH_TOKEN guardado en ${destino}\n`);
    res
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end("<h2>Listo</h2><p>El token se guardó automáticamente en .env.local. Reinicia el servidor.</p>");
  } catch (e) {
    console.error("Error al canjear el código:", e);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Error al canjear el código.");
  } finally {
    server.close();
  }
});

server.on("error", (e) => {
  console.error("No se pudo abrir el puerto", PORT, e.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log("\nAbre esta URL en el navegador (con la cuenta de la biblioteca):\n");
  console.log(authUrl + "\n");
  const cmd =
    process.platform === "win32"
      ? `start "" "${authUrl}"`
      : process.platform === "darwin"
        ? `open "${authUrl}"`
        : `xdg-open "${authUrl}"`;
  exec(cmd, () => {});
  console.log(`Esperando la autorización en ${REDIRECT} ...\n`);
});
