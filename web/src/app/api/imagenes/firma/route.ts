import { createHash } from "node:crypto";
import { withAuth, ok, HttpError } from "@/lib/http";

// Firma de subida: el API_SECRET nunca sale del servidor. El cliente sube directo a Cloudinary.
export const POST = withAuth(["BIBLIOTECARIO"], async () => {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) throw new HttpError(500, "Cloudinary no está configurado en el servidor");
  const folder = process.env.CLOUDINARY_FOLDER || "biblioscorza/libros";
  const timestamp = Math.floor(Date.now() / 1000);
  // Parámetros firmados en orden alfabético.
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
  return ok({ cloudName: cloud, apiKey: key, timestamp, folder, signature });
});
