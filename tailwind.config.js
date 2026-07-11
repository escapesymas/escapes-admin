/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tech-yellow': '#facc15',
        'tech-carbon': '#0a0a0b',
        'tech-card': '#121315',
        'tech-border': '#1e293b',
        'tech-text': '#f1f5f9',
        'tech-muted': '#94a3b8'
      }
    },
  },
  plugins: [],
}
