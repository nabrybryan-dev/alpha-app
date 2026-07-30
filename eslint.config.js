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

      // AVISOS (no bloquean, todavía). Son hallazgos reales, no ruido, pero
      // corregirlos toca 9 sitios de efectos y temporizadores —justo las zonas
      // donde ya hubo bugs de pérdida de datos—, así que es un trabajo aparte y
      // con sus propios tests, no un efecto colateral de montar el linter.
      // Al cerrarlo, subir estas dos a 'error'.
      'react-hooks/set-state-in-effect': 'warn',
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
