/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#F8FAFC',
        darkCard: '#FFFFFF',
        darkBorder: '#E2E8F0',
        accentBlue: '#2563EB',
        accentCyan: '#06B6D4',
        accentEmerald: '#10B981',
        accentAmber: '#F59E0B',
        accentRose: '#F43F5E'
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 15px rgba(37, 99, 235, 0.15)',
        glowEmerald: '0 0 15px rgba(16, 185, 129, 0.2)',
        glowRose: '0 0 15px rgba(244, 63, 94, 0.2)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    },
  },
  plugins: [],
}
