/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        linea: 'var(--linea)',
        texto: 'var(--texto)',
        tenue: 'var(--tenue)',
        rojo: 'var(--rojo)',
        'rojo-osc': 'var(--rojo-osc)',
        verde: 'var(--verde)',
        ambar: 'var(--ambar)',
        azul: 'var(--azul)',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
