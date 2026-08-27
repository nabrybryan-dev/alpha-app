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
        // Design System Alfa (handoff). accion/logrado con canal RGB
        // para soportar opacidad (bg-accion/15, border-accion/35, etc.).
        accion: 'rgb(var(--accion-rgb) / <alpha-value>)',
        'accion-osc': 'var(--accion-osc)',
        logrado: 'rgb(var(--silver-300-rgb) / <alpha-value>)',
        'ink-1000': 'rgb(var(--ink-1000-rgb) / <alpha-value>)',
        'ink-900': 'rgb(var(--ink-900-rgb) / <alpha-value>)',
        'ink-800': 'rgb(var(--ink-800-rgb) / <alpha-value>)',
        'ink-700': 'rgb(var(--ink-700-rgb) / <alpha-value>)',
        'ink-600': 'rgb(var(--ink-600-rgb) / <alpha-value>)',
        'ink-500': 'rgb(var(--ink-500-rgb) / <alpha-value>)',
        'ink-400': 'rgb(var(--ink-400-rgb) / <alpha-value>)',
        'silver-100': 'var(--silver-100)',
        'silver-200': 'var(--silver-200)',
        'silver-300': 'var(--silver-300)',
        'silver-400': 'var(--silver-400)',
        'silver-500': 'var(--silver-500)',
        'bone-50': 'var(--bone-50)',
        'bone-100': 'var(--bone-100)',
        'bone-200': 'var(--bone-200)',
        'bone-300': 'var(--bone-300)',
        paper: 'var(--paper)',
        // Solo para el nivel Élite de la Escala Alfa.
        oro: 'var(--oro)',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
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
      // Las curvas ya estaban aquí; el tiempo no, y esa era la causa raíz de que
      // ninguna duración del área de entrenamiento cayera en la escala. Sin estas
      // cuatro claves `--dur-*` no se puede escribir en una clase, así que cada
      // pantalla acababa cogiendo el valor más cercano del catálogo de Tailwind:
      // salieron 200, 700, 300, 150 y 1000 ms, ni uno del sistema.
      // Se leen del token y no se duplica el número: si la escala cambia en
      // `tokens.css`, estas clases cambian con ella.
      transitionDuration: {
        toque: 'var(--dur-toque)',
        base: 'var(--dur-base)',
        panel: 'var(--dur-panel)',
        escena: 'var(--dur-escena)',
      },
      boxShadow: {
        halo: 'var(--halo-rojo)',
        brillo: 'var(--brillo-interior)',
      },
      borderRadius: {
        panel: '1.5rem',
        nucleo: 'calc(1.5rem - 0.375rem)',
        // Radios del DS Alfa: inputs/tags 6, botones 10, cards 14, paneles 20
        tag: '6px',
        boton: '10px',
        tarjeta: '14px',
        bloque: '20px',
      },
    },
  },
  plugins: [],
}
