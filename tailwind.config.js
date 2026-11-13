/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Same variables the hand-written CSS uses, so Tailwind classes follow the day/night theme automatically.
      colors: {
        page: "var(--color-page)",
        band: "var(--color-band)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        accent: "var(--color-accent)",
        brand: "var(--color-brand)",
      },
      fontFamily: {
        body: "var(--font-body)",
        display: "var(--font-display)",
      },
    },
  },
  plugins: [],
};
