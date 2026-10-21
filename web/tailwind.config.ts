import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff4ff",
          100: "#dbe7fe",
          200: "#bfd3fe",
          300: "#93b4fd",
          400: "#608cfa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#172b4d",
        },
        ink: { DEFAULT: "#172b4d", soft: "#718096", faint: "#94a3b8" },
        paper: "#f4f7fb",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(15, 23, 42, 0.04)",
        lift: "0 11px 22px rgba(37, 99, 235, 0.27)",
        panel: "0 28px 70px rgba(11, 27, 51, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
