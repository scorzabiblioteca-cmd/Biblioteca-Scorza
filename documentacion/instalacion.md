# Instalación

## 1. Neon PostgreSQL
1. Crea un proyecto en https://neon.tech y copia la *connection string* (con `sslmode=require`).

## 2. Cloudinary
1. Crea una cuenta en https://cloudinary.com y anota *Cloud name*, *API Key* y *API Secret* (Settings → API Keys).

## 3. Web + API
```bash
cd web
cp .env.example .env.local      # completa DATABASE_URL, JWT_SECRET, GOOGLE_BOOKS_API_KEY, CLOUDINARY_*, ADMIN_*
npm install
npm run db:migrate              # aplica el esquema si la BD está vacía, migraciones y seeds
npm run db:seed-admin           # crea el usuario ADMIN de ADMIN_USERNAME / ADMIN_PASSWORD
npm run dev                     # http://localhost:3000
```
Requiere Node 20.6+. Genera `JWT_SECRET` con `openssl rand -base64 48`.
Para autocompletar libros por ISBN, habilita **Books API** en Google Cloud, crea una clave API y configúrala como `GOOGLE_BOOKS_API_KEY` en `web/.env.local`. Restringe la clave a Books API y reinicia el servidor después de cambiarla.
Nunca subas `.env.local` a GitHub (ya está en `.gitignore`).

## 4. Android
1. Abre la carpeta `android/` en Android Studio (Hedgehog o superior, JDK 17). Sincroniza Gradle.
2. Emulador: la API local se alcanza en `http://10.0.2.2:3000/api/` (ya configurado para *debug*).
   Teléfono real: usa la IP de tu PC (p. ej. `http://192.168.1.20:3000/api/`) en `app/build.gradle` (`API_BASE_URL`, buildType debug por defecto) o despliega la web.
3. Para generar un APK *release* firmado, desde `android/` crea un keystore Java válido:
   ```powershell
   keytool -genkeypair -v -keystore app\release.keystore -alias biblioscorza -keyalg RSA -keysize 2048 -validity 10000
   ```
   Guarda las contraseñas y crea `android/keystore.properties` (no lo subas a Git):
   ```properties
   storeFile=app/release.keystore
   storePassword=TU_CONTRASENA_DEL_KEYSTORE
   keyAlias=biblioscorza
   keyPassword=TU_CONTRASENA_DE_LA_CLAVE
   ```
   Gradle usa este archivo al generar el *release*. También puedes seleccionar `android/app/release.keystore` en Android Studio. No selecciones un `.pem`, certificado o archivo de configuración: no son keystores Java. Si ya existe un keystore para una versión publicada, conserva ese mismo archivo y sus contraseñas para poder actualizar la app.
4. Cambia `TU-DOMINIO.vercel.app` por tu dominio HTTPS en `android/app/build.gradle` antes de publicar.
5. Inicia sesión con el usuario creado en el paso 3. Concede permiso de cámara al escanear.

### App Web para Android
El APK de **BiblioScorza Web** es una app Android independiente que abre el panel web y conserva el inicio de sesión del sitio.
Para compilarla desde `android/` con JDK 17 y Android SDK 34:
```powershell
.\gradlew.bat :webapp:assembleDebug
```
El APK queda en `android/webapp/build/outputs/apk/debug/webapp-debug.apk`. Para publicarlo junto a la web, cópialo como
`web/public/descargas/BiblioScorzaWeb.apk` y despliega la carpeta `web`. Android siempre solicita confirmar la instalación
de un APK descargado; una página web no puede omitir esa protección.

## 5. Despliegue (opcional)
Web en Vercel: carpeta raíz `web`, variables de entorno = las de `.env.example`. Usa la cadena *pooled* de Neon.

## Uso rápido
- Crear libros por cantidad (textos comunes) o individuales (con QR por ejemplar) en **Libros → Registrar libro**.
- QR: **Ejemplares → (ejemplar)** → Descargar / Imprimir / Regenerar. El QR contiene solo el código (`LIB-000145`).
- Android: *Escanear ISBN* = registro rápido continuo; *Préstamo* y *Devolución* con QR.
