/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f0f0f0',
          100: '#d4d4d4',
          200: '#a3a3a3',
          300: '#737373',
          400: '#525252',
          500: '#404040',
          600: '#2d2d2d',
          700: '#1f1f1f',
          800: '#171717',
          900: '#0f0f0f',
          950: '#0a0a0a',
        },
        accent: {
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
          blue: '#3b82f6',
          purple: '#a855f7',
          cyan: '#06b6d4',
        },
      },
    },
  },
  plugins: [],
};
