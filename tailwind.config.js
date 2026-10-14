/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutros "salvia": fondo de página, superficies, bordes y texto.
        // 100 = fondo de app, 200 = bordes finos, 800 = tinta (texto fuerte).
        'sage': {
          50: '#f4f7f2',
          100: '#edf1ea',
          200: '#e0e7dc',
          300: '#cfd8cb',
          400: '#86958b',
          500: '#6a7a70',
          600: '#55655b',
          700: '#3b4a41',
          800: '#1e2b24',
          900: '#141c17',
        },
        // Verde botella: mesa libre, acciones principales, montos.
        'cafe-green': {
          50: '#e8f0e9',
          100: '#d3e3d7',
          200: '#a9c7b3',
          300: '#7ea98f',
          400: '#4f8668',
          500: '#2d6e4c',
          600: '#246a48',
          700: '#1d5b3e',
          800: '#154630',
          900: '#0e3624',
        },
        // Ladrillo: mesa ocupada y acciones destructivas.
        // Ámbar: mesa con un pedido por QR esperando confirmación. Misma profundidad que el verde y el ladrillo.
        'cafe-amber': {
          50: '#fbf1de',
          100: '#f2dcb0',
          200: '#e6c17f',
          300: '#d6a252',
          400: '#c0842c',
          500: '#a86d1b',
          600: '#96600f',
          700: '#865410',
          800: '#6a410c',
          900: '#523309',
        },
        'cafe-red': {
          50: '#fbedea',
          100: '#ebcfc2',
          200: '#dba796',
          300: '#c77f69',
          400: '#b05a44',
          500: '#9c3f2d',
          600: '#9e3524',
          700: '#8a2a1c',
          800: '#6b2015',
          900: '#561a10',
        },
        // Legado (marca anterior). Ya no se usa en las pantallas.
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
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'elegant': '0 4px 15px rgba(0, 0, 0, 0.1)',
        'elegant-lg': '0 8px 30px rgba(0, 0, 0, 0.15)',
        'elegant-xl': '0 12px 40px rgba(0, 0, 0, 0.2)',
        // Sombras suaves del rediseño
        'soft': '0 1px 2px rgba(30, 43, 36, 0.05), 0 14px 30px -18px rgba(30, 43, 36, 0.28)',
        'soft-lg': '0 1px 2px rgba(30, 43, 36, 0.06), 0 30px 60px -30px rgba(30, 43, 36, 0.35)',
        'dialog': '0 30px 60px -20px rgba(30, 43, 36, 0.45)',
        'brick': '0 18px 30px -18px rgba(138, 42, 28, 0.65)',
        'green': '0 18px 30px -20px rgba(29, 91, 62, 0.8)',
        'amber': '0 18px 30px -18px rgba(134, 84, 16, 0.7)',
      },
      borderRadius: {
        'card': '20px',
        'dialog': '24px',
      },
    },
  },
  plugins: [],
}
