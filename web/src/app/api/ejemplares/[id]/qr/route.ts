import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { withAuth, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { audit } from "@/lib/audit";

// El QR contiene SOLO el código interno (sin datos sensibles).
export const GET = withAuth(["BIBLIOTECARIO"], async (req, { params }) => {
  const e = await q1<{ codigoInterno: string }>(pool, "SELECT codigo_interno FROM ejemplares WHERE id = $1", [Number(params.id)]);
  if (!e) throw new HttpError(404, "Ejemplar no encontrado");
  const sp = req.nextUrl.searchParams;
  const svg = sp.get("formato") === "svg";
  const opts = { margin: 2, width: 512, errorCorrectionLevel: "M" as const };
  const data = svg ? await QRCode.toString(e.codigoInterno, { ...opts, type: "svg" }) : await QRCode.toBuffer(e.codigoInterno, opts);
  const headers: Record<string, string> = { "Content-Type": svg ? "image/svg+xml" : "image/png", "Cache-Control": "private, max-age=3600" };
  if (sp.get("descargar")) headers["Content-Disposition"] = `attachment; filename="${e.codigoInterno}.${svg ? "svg" : "png"}"`;
  return new NextResponse(data as BodyInit, { headers });
});

/** Regenerar: el QR se calcula siempre; solo se deja rastro. */
export const POST = withAuth(["BIBLIOTECARIO"], async (req, { params, session }) => {
  const id = Number(params.id);
  const e = await q1(pool, "UPDATE ejemplares SET qr_generado_en = now() WHERE id = $1 RETURNING id", [id]);
  if (!e) throw new HttpError(404, "Ejemplar no encontrado");
  await pool.query(
    "INSERT INTO historial_ejemplares (ejemplar_id, tipo_evento, usuario_id, detalle) VALUES ($1,'QR_REGENERADO',$2,'QR regenerado')",
    [id, session.id]
  );
  await audit(pool, session, "REGENERAR_QR", "ejemplares", id, null, null, req);
  return NextResponse.json({ success: true, message: "QR regenerado", data: { id } });
});
