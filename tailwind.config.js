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
        'gris-marca': 'var(--gris-marca)',
        rojo: 'var(--rojo)',
        'rojo-osc': 'var(--rojo-osc)',
        verde: 'var(--verde)',
        ambar: 'var(--ambar)',
        azul: 'var(--azul)',
      },
      fontFamily: {
        display: ['Satoshi', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderColor: {
        hairline: 'var(--hairline)',
        'hairline-fuerte': 'var(--hairline-fuerte)',
      },
      transitionTimingFunction: {
        salida: 'cubic-bezier(0.23, 1, 0.32, 1)',
        mov: 'cubic-bezier(0.77, 0, 0.175, 1)',
        cajon: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      boxShadow: {
        halo: 'var(--halo-rojo)',
        brillo: 'var(--brillo-interior)',
      },
      borderRadius: {
        panel: '1.5rem',
        nucleo: 'calc(1.5rem - 0.375rem)',
      },
    },
  },
  plugins: [],
}
