/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Segoe UI", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#8251EE",
          hover: "#9366F5",
          light: "#A37EF5",
          subtle: "rgba(130, 81, 238, 0.15)",
        },
        neutral: {
          bg1: "hsl(240, 14%, 7%)",
          bg2: "hsl(240, 10%, 10%)",
          bg3: "hsl(240, 8%, 13%)",
          bg4: "hsl(240, 7%, 17%)",
          bg5: "hsl(240, 6%, 22%)",
          bg6: "hsl(240, 5%, 27%)",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#B5B5C3",
          muted: "#77778A",
        },
        border: {
          subtle: "hsla(0, 0%, 100%, 0.08)",
          DEFAULT: "hsla(0, 0%, 100%, 0.12)",
          strong: "hsla(0, 0%, 100%, 0.20)",
        },
        status: {
          success: "#37D996",
          warning: "#FBBF24",
          error: "#FB7185",
          info: "#60A5FA",
        },
      },
      boxShadow: {
        glow: "0 0 36px rgba(130, 81, 238, 0.22)",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};
