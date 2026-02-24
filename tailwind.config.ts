import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#fdf8e8",
          100: "#faefc4",
          200: "#f5dc89",
          300: "#efc44d",
          400: "#e8ad22",
          500: "#d4920f",
          600: "#b5720b",
          700: "#91530e",
          800: "#784213",
          900: "#663713",
        },
      },
    },
  },
  plugins: [],
};

export default config;
