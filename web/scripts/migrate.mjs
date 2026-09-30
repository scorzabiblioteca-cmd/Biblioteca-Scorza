// ==========================================================
// SCRIPT DE INICIALIZACIÓN DE LA BASE DE DATOS
// ==========================================================
// Este archivo:
// 1. Comprueba si la base de datos ya tiene el esquema creado.
// 2. Si está vacía, ejecuta database/schema.sql.
// 3. Después ejecuta todos los archivos .sql de database/seeds.
// ==========================================================


// Importa el módulo "fs" de Node.js.
// Sirve para leer archivos y carpetas del sistema.
import fs from "node:fs";


// Importa el módulo "path" de Node.js.
// Sirve para construir rutas de archivos de forma segura.
import path from "node:path";


// Importa la librería "pg".
// "pg" permite conectarnos a PostgreSQL desde Node.js.
import pg from "pg";


// ==========================================================
// RUTA DE LA CARPETA DATABASE
// ==========================================================

// import.meta.dirname = carpeta donde se encuentra este archivo.
//
// ".." = subir una carpeta.
// ".." = subir otra carpeta.
// "database" = entrar a la carpeta database.
//
// Ejemplo:
//
// /biblioscorza/web/scripts/init.ts
//
//          ↓ ..
// /biblioscorza/web
//
//          ↓ ..
// /biblioscorza
//
//          ↓ database
// /biblioscorza/database
//
const root = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "database"
);


// ==========================================================
// CONEXIÓN A POSTGRESQL
// ==========================================================

// Crea un cliente de PostgreSQL.
//
// DATABASE_URL normalmente está guardado en:
// .env
// o
// .env.local
//
// Ejemplo:
// DATABASE_URL=postgresql://usuario:password@localhost:5432/biblioscorza
//
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});


// Abre la conexión con PostgreSQL.
//
// "await" significa:
// espera a que la conexión termine antes de continuar.
await client.connect();


// ==========================================================
// TRY
// ==========================================================

// Intentamos ejecutar todo el proceso.
//
// Si ocurre un error, finalmente se ejecutará el bloque "finally"
// para cerrar correctamente la conexión.
try {


  // ========================================================
  // COMPROBAR SI YA EXISTE LA TABLA usuarios
  // ========================================================

  // Ejecuta esta consulta en PostgreSQL:
  //
  // SELECT to_regclass('public.usuarios') AS t
  //
  // to_regclass() comprueba si existe una tabla u objeto.
  //
  // Si "usuarios" existe:
  //
  // t = "usuarios"
  //
  // Si no existe:
  //
  // t = null
  //
  const { rows } = await client.query(
    "SELECT to_regclass('public.usuarios') AS t"
  );


  // ========================================================
  // SI LA TABLA usuarios YA EXISTE
  // ========================================================

  if (rows[0].t) {

    // Significa que el esquema de la base de datos
    // probablemente ya fue creado.
    //
    // Por eso NO volvemos a ejecutar schema.sql.
    console.log(
      "• El esquema ya existe; se omite schema.sql"
    );


  // ========================================================
  // SI LA TABLA usuarios NO EXISTE
  // ========================================================

  } else {


    // Primero construimos la ruta:
    //
    // database/schema.sql
    //
    // Después:
    //
    // fs.readFileSync(...)
    //
    // lee todo el archivo como texto usando UTF-8.
    //
    // Finalmente:
    //
    // client.query(...)
    //
    // envía ese SQL a PostgreSQL para ejecutarlo.
    await client.query(
      fs.readFileSync(
        path.join(root, "schema.sql"),
        "utf8"
      )
    );


    // Muestra un mensaje indicando que
    // schema.sql se ejecutó correctamente.
    console.log(
      "✓ schema.sql aplicado"
    );
  }


  // ========================================================
  // CARPETA DE SEEDS
  // ========================================================

  // Construye la ruta:
  //
  // database/seeds
  //
  const seedsDir = path.join(
    root,
    "seeds"
  );


  // ========================================================
  // LEER Y EJECUTAR LOS SEEDS
  // ========================================================

  // fs.readdirSync(seedsDir)
  //
  // obtiene todos los archivos de la carpeta seeds.
  //
  // Ejemplo:
  //
  // [
  //   "001_roles.sql",
  //   "002_admin.sql",
  //   "003_categorias.sql",
  //   "README.txt"
  // ]
  //
  //
  // .filter(...)
  //
  // deja solamente archivos que terminen en ".sql".
  //
  // Resultado:
  //
  // [
  //   "001_roles.sql",
  //   "002_admin.sql",
  //   "003_categorias.sql"
  // ]
  //
  //
  // .sort()
  //
  // ordena los archivos.
  //
  // Esto permite ejecutarlos en orden:
  //
  // 001
  // 002
  // 003
  //
  for (
    const f of fs
      .readdirSync(seedsDir)
      .filter((x) => x.endsWith(".sql"))
      .sort()
  ) {


    // Construye la ruta del archivo actual.
    //
    // Ejemplo:
    //
    // database/seeds/001_roles.sql
    //
    // Después lee el archivo y ejecuta su SQL
    // dentro de PostgreSQL.
    await client.query(
      fs.readFileSync(
        path.join(seedsDir, f),
        "utf8"
      )
    );


    // Informa qué seed fue ejecutado.
    //
    // Ejemplo:
    //
    // ✓ seed 001_roles.sql
    console.log(
      "✓ seed",
      f
    );
  }


// ==========================================================
// FIN DEL TRY
// ==========================================================

} finally {


  // ========================================================
  // CERRAR CONEXIÓN
  // ========================================================

  // "finally" siempre se ejecuta.
  //
  // Incluso si ocurre un error arriba,
  // la conexión con PostgreSQL se cerrará.
  //
  // Esto evita dejar conexiones abiertas.
  await client.end();
}