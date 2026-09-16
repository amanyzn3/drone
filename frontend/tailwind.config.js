/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          950: '#030712',
          900: '#0b1329',
          800: '#111e38',
          700: '#1b2a4a',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          900: '#164e63',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          950: '#022c22',
        },
      },
      animation: {
        'radar-sweep': 'sweep 4s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(34, 211, 238, 0.2)' },
          '100%': { boxShadow: '0 0 25px rgba(34, 211, 238, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
