import pg from "pg";
import bcrypt from "bcryptjs";

const { ADMIN_USERNAME: u, ADMIN_PASSWORD: p, ADMIN_NOMBRE } = process.env;
if (!u || !p || p.length < 8) {
  console.error("Define ADMIN_USERNAME y ADMIN_PASSWORD (mínimo 8 caracteres) en .env.local");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const hash = await bcrypt.hash(p, 12);
  const ex = await client.query("SELECT id FROM usuarios WHERE lower(username)=lower($1)", [u]);
  if (ex.rows.length) {
    console.log("• El usuario ya existe, no se modifica.");
  } else {
    const r = await client.query(
      "INSERT INTO usuarios (username, nombre_completo, password_hash) VALUES ($1,$2,$3) RETURNING id",
      [u, ADMIN_NOMBRE || "Administrador", hash]
    );
    await client.query(
      "INSERT INTO usuarios_roles (usuario_id, rol_id) SELECT $1, id FROM roles WHERE codigo='ADMIN'",
      [r.rows[0].id]
    );
    console.log(`✓ Usuario ADMIN '${u}' creado`);
  }
} finally {
  await client.end();
}
