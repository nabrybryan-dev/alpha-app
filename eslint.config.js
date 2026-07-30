// Linter de la app.
//
// Antes esto era `oxlint` (ver `.oxlintrc.json`, ya retirado), pero su binario
// nativo lo bloquea la directiva de Control de aplicaciones (WDAC) de esta
// máquina —el mismo motivo por el que Vite usa `esbuild-wasm` y
// `@rollup/wasm-node`—. ESLint es JavaScript puro, así que corre igual aquí y en
// CI. **No sustituir por un linter con binario nativo.**
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', '.vite', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // GATE (bloquea): la regla que caza el error nº1 de React y la que ya
      // declaraba `.oxlintrc.json` sin llegar a ejecutarse nunca. Hoy: 0 violaciones.
      'react-hooks/rules-of-hooks': 'error',

      // GATE desde el 2026-07-29. Los 7 avisos que destapó se cerraron: cuatro eran
      // valores que ya se conocían antes del primer render, uno era `Stepper`
      // (refactorizado con tests nuevos), y tres quedan como excepciones explícitas
      // con `eslint-disable` y su motivo escrito al lado (los dos de `CheckinForm`,
      // donde la forma que sugiere la regla pierde una guarda de integridad de
      // datos, y el `void traer()` de `ConsultasPage`, que es un falso positivo:
      // sus setState van después del await).
      //
      // En 'error' porque una excepción justificada y visible en el diff protege
      // mucho más que un aviso que nadie mira.
      'react-hooks/set-state-in-effect': 'error',

      // Sigue en aviso: hoy 0 apariciones. Los dos que había eran falsos positivos
      // por tamaño de archivo y se fueron al partir `SesionPage`.
      'react-hooks/purity': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Los scripts de Node corren fuera del navegador.
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
)
