/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heb: [
          "Assistant",
          "Heebo",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      colors: {
        bg: "#0b0d12",
        panel: "#141821",
        panel2: "#1b212d",
        ink: "#e6e8ee",
        ink2: "#a3aab8",
        accent: "#7c5cff",
        ops: "#3aa6ff",
        dev: "#ff7c5c",
        knowledge: "#5cd6a8",
        ceo: "#ffc857",
      },
    },
  },
  plugins: [],
};
