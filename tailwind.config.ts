import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        medika: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        mbi: {
          DEFAULT: '#0284c7', // Sky Blue for MBI
          light: '#e0f2fe',
          dark: '#0369a1',
        },
        mai: {
          DEFAULT: '#7c3aed', // Purple for MAI
          light: '#f3e8ff',
          dark: '#6d28d9',
        }
      },
    },
  },
  plugins: [],
};
export default config;
