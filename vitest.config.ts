import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Los tests siempre corren en modo demo, aunque .env.local tenga credenciales
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
    // 20 s en vez de los 5 s por defecto. Casi todo test de pantalla espera a que
    // se resuelva un `React.lazy` del router; el más lento tarda ~3 s aislado y
    // bastante más con la suite en paralelo o con cobertura encima. Con 5 s el test
    // moría por timeout antes de que la aserción pudiera fallar con un mensaje útil,
    // y el rojo parecía un bug de la app cuando era del arnés de pruebas.
    // Debe quedar POR ENCIMA del `asyncUtilTimeout` de `src/test/setup.ts`.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // Ni datos ni andamiaje: medirlos mueve el porcentaje sin decir nada.
      exclude: ['src/data/seed/**', 'src/assets/**', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'html'],
      // Umbrales-trinquete: fijados en lo que hay HOY (medido, no aspiracional) para
      // que la cobertura no BAJE. No son la meta: `src/domain/` es lógica pura y
      // debería acercarse al 90 %; hoy va por 74 %. Cuando un cambio los suba, subir
      // el umbral con él. El global es bajo a propósito porque incluye pantallas,
      // donde la cobertura útil viene de tests de comportamiento y no de recorrer JSX.
      //
      // Van ~1 punto por debajo de lo medido a propósito: el porcentaje oscila unas
      // décimas entre corridas (50,31 % y 50,48 % en dos seguidas), y un umbral
      // pegado al valor exacto produciría fallos aleatorios. Un gate intermitente se
      // acaba ignorando, que es peor que no tenerlo.
      thresholds: {
        lines: 49,
        statements: 49,
        functions: 64,
        branches: 76,
        'src/domain/**': {
          lines: 73,
          statements: 73,
          functions: 94,
          branches: 87,
        },
      },
    },
  },
})
