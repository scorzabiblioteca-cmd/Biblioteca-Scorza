import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

export type Session = { id: number; username: string; roles: string[] };
export const COOKIE = "bs_token";
const RESET_PURPOSE = "password_reset";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET no configurado (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function signToken(s: Session) {
  return new SignJWT({ username: s.username, roles: s.roles, purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.id))
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || "12h")
    .sign(secret());
}

export async function verifyToken(t: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(t, secret());
    // Los tickets de recuperación no son tokens de sesión.
    if (payload.purpose && payload.purpose !== "session") return null;
    return { id: Number(payload.sub), username: String(payload.username), roles: (payload.roles as string[]) ?? [] };
  } catch {
    return null;
  }
}

/** Ticket de corta duración emitido tras verificar el código de recuperación. */
export async function signResetTicket(usuarioId: number) {
  return new SignJWT({ purpose: RESET_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(usuarioId))
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

export async function verifyResetTicket(t: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(t, secret());
    if (payload.purpose !== RESET_PURPOSE) return null;
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Acepta 'Authorization: Bearer' (Android) o cookie httpOnly (web). */
export async function getSession(req: NextRequest): Promise<Session | null> {
  const h = req.headers.get("authorization");
  const token = h?.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : req.cookies.get(COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);
