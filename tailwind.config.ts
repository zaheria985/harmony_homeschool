import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
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
          50: "#eef4ef",
          100: "#dce8dd",
          200: "#b5d1b8",
          300: "#8fb593",
          400: "#6f9a73",
          500: "#5a7a5e",
          600: "#4a6a4e",
          700: "#3d6641",
          800: "#2d4a30",
          900: "#1e3320",
        },
        success: {
          50: "#eef4ef",
          100: "#dce8dd",
          500: "#5a7a5e",
          600: "#4a6a4e",
          700: "#3d6641",
        },
        warning: {
          50: "#fdf6eb",
          100: "#f8ead0",
          500: "#c4952d",
          600: "#a87d25",
          700: "#8a6d2b",
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
      borderRadius: {
        card: "var(--radius-card)",
      },
    },
  },
  plugins: [],
};

export default config;
