/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["pg"],
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: "/descargas/:path*",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="BiblioScorza.apk"' },
        ],
      },
    ];
  },
};
export default nextConfig;
