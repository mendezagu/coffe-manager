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
          50: '#f6f7f9',
          100: '#eef0f3',
          200: '#e1e5ea',
          300: '#cdd3da',
          400: '#8a94a4',
          500: '#5d6879',
          600: '#4f5a6b',
          700: '#363f4e',
          800: '#262d39',
          900: '#181d26',
        },
        // Verde agua (marca): acciones principales (700, texto blanco), tintes (50-200) y texto oscuro (900).
        'cafe-green': {
          50: '#ecfcf7',
          100: '#d4f8ee',
          200: '#a8efdd',
          300: '#6fe3c6',
          400: '#1fa88c',
          500: '#0f9179',
          600: '#0d8670',
          700: '#0b7d66',
          800: '#08604f',
          900: '#084440',
        },
        // Menta brillante (#2ED0AB): acentos y superficies con texto oscuro.
        'cafe-mint': {
          50: '#ecfcf7',
          100: '#d4f8ee',
          200: '#a8efdd',
          300: '#6fe3c6',
          400: '#4adbb8',
          500: '#2ed0ab',
          600: '#22b592',
        },
        // Ladrillo: mesa ocupada y acciones destructivas.
        // Pantalla del cliente (pedido por QR): crema y verde bosque
        'crema': { DEFAULT: '#F7F9FA', dark: '#EEF1F4' },
        // Lee el color de marca del restaurante (variables que fija la pantalla del cliente); sin ellas, verde bosque
        'forest': {
          DEFAULT: 'rgb(var(--brand-rgb, 11 125 102) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover-rgb, 8 96 79) / <alpha-value>)',
          light: 'rgb(var(--brand-light-rgb, 15 145 121) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft-rgb, 232 250 245) / <alpha-value>)',
        },
        // Pantalla del cliente, diseño "Nuovo": superficies cálidas, tinta y verde de apoyo (el color de marca es `forest`)
        // (leen variables --q-* que la carta oscura redefine en qr-order.component.ts)
        'surface': {
          DEFAULT: 'rgb(var(--q-surface, 247 249 250) / <alpha-value>)',
          low: 'rgb(var(--q-surface-low, 242 244 246) / <alpha-value>)',
          mid: 'rgb(var(--q-surface-mid, 236 239 242) / <alpha-value>)',
          high: 'rgb(var(--q-surface-high, 229 233 237) / <alpha-value>)',
          highest: 'rgb(var(--q-surface-highest, 222 227 232) / <alpha-value>)',
          lowest: 'rgb(var(--q-surface-lowest, 255 255 255) / <alpha-value>)',
        },
        'ink': { DEFAULT: 'rgb(var(--q-ink, 24 29 38) / <alpha-value>)', variant: 'rgb(var(--q-ink-variant, 79 90 107) / <alpha-value>)' },
        'line': { DEFAULT: 'rgb(var(--q-line, 102 113 132) / <alpha-value>)', soft: 'rgb(var(--q-line-soft, 205 211 218) / <alpha-value>)' },
        'leaf': {
          DEFAULT: 'rgb(var(--q-leaf, 11 125 102) / <alpha-value>)',
          container: 'rgb(var(--q-leaf-container, 200 243 232) / <alpha-value>)',
          dim: 'rgb(var(--q-leaf-dim, 111 227 198) / <alpha-value>)',
          ink: 'rgb(var(--q-leaf-ink, 8 68 64) / <alpha-value>)',
          ink2: 'rgb(var(--q-leaf-ink2, 8 96 79) / <alpha-value>)',
        },
        'tertiary': { container: '#4d2d07', fixed: '#ffdcbd', ink: '#2c1600' },
        'charcoal': '#1C222D',
        'muted': '#667184',
        // Ámbar: mesa con un pedido por QR esperando confirmación. Misma profundidad que el verde y el ladrillo.
        'cafe-amber': {
          50: '#fff3ea',
          100: '#fde0cc',
          200: '#f9c4a1',
          300: '#f2a574',
          400: '#ec9060',
          500: '#e6834a',
          600: '#d8733a',
          700: '#c4602b',
          800: '#9a4a20',
          900: '#73381a',
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
        // Solo la pantalla del cliente (pedido por QR)
        jakarta: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
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
        'amber': '0 18px 30px -18px rgba(196, 96, 43, 0.7)',
        'floating': '0 12px 30px -4px rgba(30, 58, 47, 0.22)',
      },
      borderRadius: {
        'card': '20px',
        'dialog': '24px',
      },
    },
  },
  plugins: [],
}
