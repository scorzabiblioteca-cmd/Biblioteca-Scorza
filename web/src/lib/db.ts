import { Pool, PoolClient, types } from "pg";

// BIGINT/COUNT llegan como número; DATE se mantiene como texto 'YYYY-MM-DD'.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(1082, (v) => v);

const g = globalThis as unknown as { __pool?: Pool };
export const pool: Pool =
  g.__pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 20_000,
  });
if (process.env.NODE_ENV !== "production") g.__pool = pool;

export type Db = Pool | PoolClient;

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Consulta parametrizada; convierte columnas snake_case a camelCase. */
export async function q<T = Row>(db: Db, text: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.query(text, params as unknown[]);
  return r.rows.map((row: Row) => {
    const o: Row = {};
    for (const k of Object.keys(row)) o[camel(k)] = row[k];
    return o as T;
  });
}
export async function q1<T = Row>(db: Db, text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(db, text, params))[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
