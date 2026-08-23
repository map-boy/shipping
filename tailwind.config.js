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
        rwBlue: "#00A1DE",
        rwYellow: "#FAD201",
        rwGreen: "#00A651",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(24px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        pulseOnce: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        fadeInUp: "fadeInUp 0.7s ease-out both",
        pulseOnce: "pulseOnce 0.6s ease-in-out",
      },
    },
  },
  plugins: [],
}
