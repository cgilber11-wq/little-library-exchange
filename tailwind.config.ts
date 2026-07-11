import type { Config } from "tailwindcss";

/**
 * Soothing pastel palette. We remap the accent color families the app already
 * uses (emerald, amber, sky) onto softer, lower-chroma scales so the whole UI
 * calms down from a single source of truth. Light shades (50-200) are gentle
 * wash tones for surfaces; 600-800 stay deep enough to keep white button text
 * readable.
 */
const sage = {
  50: "#f4f8f5",
  100: "#e7f0ea",
  200: "#cfe1d5",
  300: "#aecbb8",
  400: "#84ad94",
  500: "#629076",
  600: "#4d7c61",
  700: "#3f6650",
  800: "#355241",
  900: "#2d4537",
  950: "#16271d",
};

const apricot = {
  50: "#fdf6f0",
  100: "#fae9da",
  200: "#f4d3b6",
  300: "#ecb588",
  400: "#e09360",
  500: "#d27842",
  600: "#bd6235",
  700: "#9c4f2d",
  800: "#7e4127",
  900: "#683723",
  950: "#381a10",
};

const periwinkle = {
  50: "#f1f6fb",
  100: "#e3edf7",
  200: "#c5dbee",
  300: "#9cc0e0",
  400: "#6c9fce",
  500: "#4980b5",
  600: "#3a6a9b",
  700: "#30567f",
  800: "#2b4868",
  900: "#273d57",
  950: "#1a2839",
};

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-source-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"],
      },
      colors: {
        emerald: sage,
        amber: apricot,
        sky: periwinkle,
        cream: {
          50: "#fffcf8",
          100: "#faf7f2",
          200: "#f3ede4",
          300: "#e8dfd3",
          400: "#d9cbb9",
        },
      },
      boxShadow: {
        cozy: "0 1px 2px rgba(44, 40, 37, 0.04), 0 4px 18px rgba(44, 40, 37, 0.06)",
        header: "0 1px 0 rgba(44, 40, 37, 0.07), 0 4px 12px rgba(44, 40, 37, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
