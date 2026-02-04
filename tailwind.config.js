/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#FFD700',
          50: '#FFF9E6',
          100: '#FFF3CC',
          200: '#FFE799',
          300: '#FFDB66',
          400: '#FFCF33',
          500: '#FFD700',
          600: '#CCAC00',
          700: '#998100',
          800: '#665600',
          900: '#332B00',
        },
        dark: {
          bg: '#0f172a',
          card: 'rgba(15, 23, 42, 0.7)',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'gold-glow': '0 0 40px rgba(255, 215, 0, 0.15)',
        'gold-glow-sm': '0 0 20px rgba(255, 215, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
