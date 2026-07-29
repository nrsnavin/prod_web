/** @type {import('tailwindcss').Config} */

// Every colour token resolves through a CSS variable holding space-separated
// RGB channels ("28 28 28"), so the `/opacity` modifier keeps working
// (`bg-ink-900/50` → `rgb(28 28 28 / 0.5)`). The light and dark values live
// in src/index.css under `:root` and `.dark`; flipping that one class
// re-themes every screen without a single `dark:` utility in the markup.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

const ramp = (prefix, stops) =>
  Object.fromEntries(stops.map((s) => [s, token(`${prefix}-${s}`)]));

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand — one bold accent, used sparingly (Zomato-style)
        brand: ramp("brand", [50, 100, 400, 500, 600, 700]),

        // Page background, and the raised sheet that cards/inputs sit on.
        // `surface` is what used to be a hardcoded `bg-white`.
        canvas: token("canvas"),
        surface: {
          DEFAULT: token("surface"),
          muted: token("surface-muted"),
        },
        // Text and lines. The scale runs dark→light in the light theme and
        // inverts in dark, so `text-ink-900` is always "strongest text" and
        // `border-ink-200` is always "a hairline".
        ink: ramp("ink", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),

        // Semantic status colors (chips, banners). The base tone is tuned to
        // be legible *as text*, which is how it is used almost everywhere;
        // `dangerSolid` is the filled-button variant that has to carry white
        // text, so it stays dark enough for that in both themes.
        status: {
          success: token("status-success"),
          successBg: token("status-success-bg"),
          warning: token("status-warning"),
          warningBg: token("status-warning-bg"),
          info: token("status-info"),
          infoBg: token("status-info-bg"),
          danger: token("status-danger"),
          dangerBg: token("status-danger-bg"),
          dangerSolid: token("status-danger-solid"),
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
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
