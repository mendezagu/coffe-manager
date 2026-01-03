/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'coffee': {
          50: '#f9f5f0',
          100: '#f3e9dc',
          200: '#e7d3b9',
          300: '#dbb896',
          400: '#cf9d73',
          500: '#8b6f47',
          600: '#6f4e37',
          700: '#5a3e2b',
          800: '#3e2723',
          900: '#2c1810',
        },
        'cafe-green': {
          50: '#e8f5e9',
          100: '#c8e6c9',
          200: '#a5d6a7',
          300: '#81c784',
          400: '#66bb6a',
          500: '#43A047',
          600: '#2E7D32',
          700: '#1B5E20',
          800: '#145214',
          900: '#0d3d0d',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'elegant': '0 4px 15px rgba(0, 0, 0, 0.1)',
        'elegant-lg': '0 8px 30px rgba(0, 0, 0, 0.15)',
        'elegant-xl': '0 12px 40px rgba(0, 0, 0, 0.2)',
      },
      borderRadius: {
        'card': '12px',
        'dialog': '16px',
      },
    },
  },
  plugins: [],
}
