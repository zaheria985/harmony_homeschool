import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
          subtle: "var(--surface-subtle)",
          slate: "var(--surface-slate)",
        },
        interactive: {
          DEFAULT: "var(--interactive)",
          hover: "var(--interactive-hover)",
          light: "var(--interactive-light)",
          medium: "var(--interactive-medium)",
          border: "var(--interactive-border)",
        },
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        success: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
      },
      textColor: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
        muted: "var(--text-muted)",
        interactive: "var(--interactive)",
        "interactive-hover": "var(--interactive-hover)",
      },
      borderColor: {
        border: "var(--border)",
        light: "var(--border-light)",
        slate: "var(--border-slate)",
        "interactive-border": "var(--interactive-border)",
      },
      ringColor: {
        focus: "var(--input-focus-ring)",
      },
    },
  },
  plugins: [],
};

export default config;
