/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["pg"],
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
};
export default nextConfig;
