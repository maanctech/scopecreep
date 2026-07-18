import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        paper: "#ffffff",
        audit: {
          border: "#e5e7eb",
          soft: "#f7f7f8",
          muted: "#6b7280"
        }
      },
      boxShadow: {
        audit: "0 1px 2px rgba(17, 17, 17, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
