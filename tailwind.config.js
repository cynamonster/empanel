/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        juror: {
          positive: "#10b981", // emerald
          neutral: "#64748b",  // slate
          negative: "#ef4444", // red
        }
      }
    },
  },
  plugins: [],
}
