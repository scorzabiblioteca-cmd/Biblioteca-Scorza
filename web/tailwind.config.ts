import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef6f2", 100: "#d5eadf", 500: "#2f7d5b", 600: "#24664a", 700: "#1c503a", 900: "#12301f" },
        paper: "#f6f5f1",
      },
    },
  },
  plugins: [],
};
export default config;
