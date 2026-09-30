# Instalación

## 1. Neon PostgreSQL
1. Crea un proyecto en https://neon.tech y copia la *connection string* (con `sslmode=require`).

## 2. Cloudinary
1. Crea una cuenta en https://cloudinary.com y anota *Cloud name*, *API Key* y *API Secret* (Settings → API Keys).

## 3. Web + API
```bash
cd web
cp .env.example .env.local      # completa DATABASE_URL, JWT_SECRET, CLOUDINARY_*, ADMIN_*
npm install
npm run db:migrate              # aplica database/schema.sql (solo si la BD está vacía) + seeds
npm run db:seed-admin           # crea el usuario ADMIN de ADMIN_USERNAME / ADMIN_PASSWORD
npm run dev                     # http://localhost:3000
```
Requiere Node 20.6+. Genera `JWT_SECRET` con `openssl rand -base64 48`.
Nunca subas `.env.local` a GitHub (ya está en `.gitignore`).

## 4. Android
1. Abre la carpeta `android/` en Android Studio (Hedgehog o superior, JDK 17). Sincroniza Gradle.
2. Emulador: la API local se alcanza en `http://10.0.2.2:3000/api/` (ya configurado para *debug*).
   Teléfono real: usa la IP de tu PC (p. ej. `http://192.168.1.20:3000/api/`) en `app/build.gradle` (`API_BASE_URL`, buildType debug por defecto) o despliega la web.
3. Para *release* cambia `TU-DOMINIO.vercel.app` por tu dominio HTTPS.
4. Inicia sesión con el usuario creado en el paso 3. Concede permiso de cámara al escanear.

## 5. Despliegue (opcional)
Web en Vercel: carpeta raíz `web`, variables de entorno = las de `.env.example`. Usa la cadena *pooled* de Neon.

## Uso rápido
- Crear libros por cantidad (textos comunes) o individuales (con QR por ejemplar) en **Libros → Registrar libro**.
- QR: **Ejemplares → (ejemplar)** → Descargar / Imprimir / Regenerar. El QR contiene solo el código (`LIB-000145`).
- Android: *Escanear ISBN* = registro rápido continuo; *Préstamo* y *Devolución* con QR.
