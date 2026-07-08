/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — one bold accent, used sparingly (Zomato-style)
        brand: {
          50: "#FEF1F2",
          100: "#FDE0E2",
          500: "#E23744",
          600: "#C42B37",
          700: "#A3212C",
        },
        // Neutral canvas
        canvas: "#F8F8F8",
        ink: {
          900: "#1C1C1C",
          600: "#4F4F4F",
          400: "#828282",
          200: "#E0E0E0",
          100: "#F0F0F0",
        },
        // Semantic status colors (chips, banners)
        status: {
          success: "#1E8E3E",
          successBg: "#E6F4EA",
          warning: "#B26A00",
          warningBg: "#FFF4E0",
          info: "#1967D2",
          infoBg: "#E8F0FE",
          danger: "#C5221F",
          dangerBg: "#FCE8E6",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.10)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
