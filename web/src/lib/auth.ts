import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

export type Session = { id: number; username: string; roles: string[] };
export const COOKIE = "bs_token";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET no configurado (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function signToken(s: Session) {
  return new SignJWT({ username: s.username, roles: s.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.id))
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || "12h")
    .sign(secret());
}

export async function verifyToken(t: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(t, secret());
    return { id: Number(payload.sub), username: String(payload.username), roles: (payload.roles as string[]) ?? [] };
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
