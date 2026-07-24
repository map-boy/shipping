/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        heroFrom: "#0f4c8b",
        heroTo: "#3b82f6",
        cta: "#fea142",
        ctaHover: "#f98b1b",
      },
    },
  },
  plugins: [],
}
