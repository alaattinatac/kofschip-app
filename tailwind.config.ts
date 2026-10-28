/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dutch-inspired & Duolingo/Apple modern color palette
        kofschip: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcceff',
          300: '#8eaeff',
          400: '#597fff',
          500: '#3455ff',   // Vibrant electric blue / indigo
          600: '#233ef5',
          700: '#1d2fe0',
          800: '#1727b5',
          900: '#17258f',
        },
        oranje: {
          50: '#fff8f2',
          100: '#ffefe1',
          200: '#fedbc4',
          300: '#fdbb99',
          400: '#fb8e63',
          500: '#f96532',   // Vibrant Dutch orange accent
          600: '#eb4918',
          700: '#c43410',
          800: '#9c2b12',
          900: '#7e2614',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        correct: '#10b981',
        incorrect: '#f43f5e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-indigo': '0 12px 30px -10px rgba(79, 70, 229, 0.25)',
        'glow-emerald': '0 12px 30px -10px rgba(16, 185, 129, 0.25)',
        'glow-oranje': '0 12px 30px -10px rgba(249, 101, 50, 0.25)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.06)',
        'glass-hover': '0 14px 40px -10px rgba(31, 38, 135, 0.12)',
        'neo-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        'glow-indigo-lg': '0 0 35px -5px rgba(99, 102, 241, 0.35)',
        'glow-emerald-lg': '0 0 35px -5px rgba(16, 185, 129, 0.35)',
      },
      // iOS safe area support
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
};
