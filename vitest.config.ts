import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Los worktrees de los agentes viven DENTRO del repo (`.claude/worktrees/`), así
    // que sus tests entran al glob y se corren como si fueran de aquí: copias viejas
    // del mismo archivo, ejecutadas dos y tres veces, ensombreciendo a la de `src/`.
    // Desde la raíz eso son 884 archivos globados donde solo 234 son de este árbol.
    //
    // Se parte de `configDefaults.exclude` a propósito: un array literal REEMPLAZA
    // el default y volvería a globar `node_modules`.
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
    // Vitest usa por defecto un fork por CPU: aquí son 16 procesos levantando jsdom +
    // React + Supabase a la vez sobre 15 GB de RAM. Ese pico de arranque es donde
    // `verify` murió con `Worker exited unexpectedly` de tinypool (el hijo desaparece
    // sin hablar el protocolo, no es un OOM de heap del propio proceso), y de donde
    // salen los fallos intermitentes de *collect* sobre archivos que pasan solos y
    // pasan al repetir.
    //
    // La mitad de los forks NO es gratis: medido el 2026-09-08 sobre estos 320
    // archivos, 60,3 s con 8 contra 48,4 s con 16. Se pagan esos ~12 s a cambio de no
    // volver a perder una corrida entera por un hijo que muere en el arranque.
    //
    // `minForks` hay que bajarlo con él: por defecto también vale
    // `availableParallelism()`, y tinypool aborta el arranque entero con
    // `options.minThreads and options.maxThreads must not conflict` si el mínimo
    // queda por encima del máximo.
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 8,
      },
    },
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
      // debería acercarse al 90 %. El global es bajo a propósito porque incluye
      // pantallas, donde la cobertura útil viene de tests de comportamiento y no de
      // recorrer JSX.
      //
      // **Cuando un cambio los suba, subir el umbral con él**, o el trinquete deja de
      // trincar. Medido en `main` el 2026-07-30 con 289 tests:
      //   · dominio  78,29 líneas · 90,19 ramas · 98,63 funciones
      //   · global   51,95 líneas · 78,96 ramas · 68,67 funciones
      // El dominio subió de 74,4 a 78,3 al recuperar el motor de ondulación, que
      // llegó con 328 líneas de tests propios.
      //
      // Vuelto a medir el 2026-08-27 al entrar el visor de patrones:
      //   · dominio  89,81 líneas · 93,52 ramas · 99,03 funciones
      //   · global   75,58 líneas · 86,22 ramas · 81,31 funciones
      // El salto del dominio es casi todo de `domain/patrones/`, que entró al 100 %
      // de funciones. Se suben los umbrales del dominio; los globales se dejan como
      // estaban aunque también hayan subido, porque ese salto no es de este cambio
      // sino de un mes de trabajo, y apretarlos merece su propia tanda.
      //
      // Van ~1 punto por debajo de lo medido a propósito: el porcentaje oscila unas
      // décimas entre corridas, y un umbral pegado al valor exacto produciría fallos
      // aleatorios. Un gate intermitente se acaba ignorando, que es peor que no
      // tenerlo.
      thresholds: {
        lines: 50,
        statements: 50,
        functions: 67,
        branches: 77,
        'src/domain/**': {
          lines: 88,
          statements: 88,
          functions: 98,
          branches: 92,
        },
      },
    },
  },
})
