# App Alpha Athletics — instrucciones del proyecto

PWA que usan **asesorados en pleno entrenamiento** (móvil, gimnasio, conexión
inestable) y el **staff** (coach y nutricionista). Maneja **datos reales de salud**.

> **Idioma del código: español.** Nombres de variables, funciones, componentes,
> archivos y comentarios en español (`descanso`, `filtrarSeed`, `SesionPage`). No
> traducir lo existente ni introducir nombres en inglés.

---

## 1. Restricción de la máquina — NO NEGOCIABLE

La directiva de **Control de aplicaciones (WDAC)** de este equipo **bloquea los
binarios nativos de npm**. Consecuencias que no se pueden revertir aquí:

- `package.json` fija `overrides` a `esbuild-wasm` y `@rollup/wasm-node`. **No
  quitarlos.**
- Tailwind **v3** (JS puro), no v4.
- **No elegir herramientas con binario nativo.** Ya nos costó una vez: `oxlint`
  quedó configurado pero inservible (su `.node` bloqueado), el script `lint` se
  degradó a `tsc -b` y durante semanas creímos tener un linter que no corría. Por
  eso el linter es **ESLint** (JavaScript puro). Antes de proponer una herramienta,
  comprobar que no dependa de un `.node` ni de un `.exe`.

---

## 2. Comando único antes de cualquier push

```bash
npm run verify
```

Corre `typecheck` (`tsc -b`, con **`strict` activado**) + `lint` (ESLint) +
`test` (vitest). Debe salir en verde: **0 errores**. La cifra de tests sube casi a
diario (el 2026-08-03 eran **1.098 en 93 archivos**), así que el criterio no es
igualar un número: es que **no baje** y que no aparezca ni un rojo. Si vas a citar
un total, mídelo, no lo copies de aquí — este dato ya estuvo catorce días desfasado
diciendo «242» y nadie lo notó.

Los mismos tres pasos corren en CI (`.github/workflows/ci.yml`) en cada push y PR.

**Aviso de despliegue:** Vercel publica en producción **con solo hacer push a
`main`**. El CI no lo bloquea por sí solo. Trabajar en rama y no empujar a `main`
sin autorización explícita.

### Avisos del linter que están pendientes a propósito

Dos reglas son **error** y bloquean: `react-hooks/rules-of-hooks` y —desde el
2026-07-29— `react-hooks/set-state-in-effect`. Esta segunda **ya se cerró**: los 7
avisos que destapó se arreglaron y quedan tres `eslint-disable` con su motivo
escrito al lado (`eslint.config.js:34-44`). No la trates como pendiente ni la
reabras. `react-hooks/purity` también está a cero.

Lo que queda abierto son **5 avisos** (2026-08-03), todos anteriores al trabajo de
julio y ninguno en zona de riesgo: 4 de `react-refresh/only-export-components`
(`SessionProvider.tsx:310`, `ThemeProvider.tsx:31`, `CronometroSesion.tsx:54` y
`:59` — archivos que exportan un componente **y** un hook) y 1 de
`react-hooks/exhaustive-deps` (`DescansoTimer.tsx:100`, falta `cerrarUnaVez`).

La regla es un **delta, no un presupuesto**: corre el linter antes y después de tu
cambio y no dejes ni un aviso más de los que había. No los arregles de pasada
dentro de otro cambio; van en su propia tanda **con tests**.

---

## 3. Arquitectura y dónde va cada cosa

| Carpeta | Qué contiene | Regla |
|---|---|---|
| `src/domain/` | Lógica pura: fatiga, ranking, readiness, cumplimiento, gamificación, ritmo de sesión, fichas, calendario | **Sin React, sin I/O.** Cada módulo con su `.test.ts` al lado. **Aquí va toda regla de negocio nueva.** |
| `src/data/` | Acceso a datos: `repos.ts` (interfaz `Db`), `mockDb.ts`, `nube/sync.ts`, `nube/hidratar.ts`, `seed/` | Patrón repositorio. La UI **nunca** habla con Supabase directamente. |
| `src/features/<dominio>/` | Pantallas y componentes por dominio de negocio | Un dominio no importa de otro; lo común sube a `components/ui/`. |
| `src/components/ui/` | Primitivas reutilizables (16 archivos; `MacroPill` está sin uso desde el rediseño de julio) | Sin lógica de negocio. |
| `src/app/` | Router, `SessionProvider`, `ThemeProvider`, `ErrorBoundary`, layouts | |
| `src/styles/tokens.css` | Tokens de marca | **El diseño se hace con Tailwind + estos tokens.** No añadir CSS-in-JS, CSS Modules ni Bootstrap. |
| `supabase/migrations/` | Migraciones numeradas (`0001`…`0023`) | Nueva migración = número siguiente, nunca editar una aplicada. **Mira la carpeta antes de elegir número:** dos ramas cogieron `0020` a la vez y una tuvo que renumerarse a `0021` después de estar aplicada. **Se aplican a mano en el SQL Editor: no hay registro de versiones.** Comprobar el estado real con `supabase/comprobar-migraciones.sql` y añadirle las señales de cada migración nueva. |
| `scripts/` | Utilidades Node (`.mjs`) | Si un test las importa, mantener su `.d.mts` al día. |

### Cómo fluyen los datos

- `src/data/dbInstance.ts` expone **un único** `db = crearDbSincronizada(crearMockDb())`:
  la app siempre lee del almacén local y la capa de sincronización lo sube/baja de
  la nube. Las pantallas no distinguen los dos modos.
- `modoNube` (`src/data/supabase.ts`) es `true` solo si existen `VITE_SUPABASE_URL`
  y `VITE_SUPABASE_ANON_KEY`. Sin ellas la app corre en **modo demo** con el seed
  de "Valentina Cruz". **Los tests siempre corren en modo demo** (forzado en
  `vitest.config.ts`).
- Los componentes se refrescan con `useDbVersion()` (`useSyncExternalStore`), no
  con estado duplicado.

---

## 4. Privacidad y seguridad — primero en la jerarquía

1. **Datos de salud reales.** Nunca poner nombres, medidas, notas ni mensajes de
   asesorados en código, tests, comentarios, commits ni documentación. Los tests
   usan el seed ficticio de Valentina.
2. **Aislamiento entre asesorados.** Es la propiedad más importante de la app y ya
   se rompió dos veces. Hay tests dedicados que la protegen
   (`SessionProvider.aislamiento.test.tsx`, `data/nube/perdida-datos.test.ts`): si
   un cambio los pone en rojo, el cambio está mal, no el test.
3. **RLS.** Toda tabla nueva necesita su política. Cuidado con las políticas
   tautológicas (`rol = rol` permitió auto-promoverse a coach: migración `0008`).
4. **Nunca commitear** claves, `.env.local`, `CLAVES.local.txt`, archivos
   `*.local.sql` ni cargas de asesorados.

---

## 5. Cómo trabajar aquí

- **Plan antes de código** para cualquier cambio no trivial: `docs/specs/` (qué y
  por qué) y `docs/plans/` (pasos), fechados.
- **Tests primero cuando hay un fallo.** El patrón de este repo: un commit con el
  test que **documenta** el bug en rojo, y después el commit que lo arregla. Deja
  el rastro de por qué existe cada test.
- **Cuando un test de regresión se arregle, actualizar su encabezado.** Un
  comentario que dice «esto falla a propósito» cuando ya está corregido desmiente
  al siguiente que lo lea.
- **Tamaño:** 200–400 líneas por archivo, 800 máximo. Funciones bajo 50 líneas.
- **Inmutabilidad:** copiar y devolver, no mutar. Los bugs de pérdida de datos de
  este repo vinieron de mutar objetos compartidos.
- **Commits** convencionales (`feat`, `fix`, `refactor`, `test`, `chore`), en
  español y describiendo el efecto en la persona que usa la app, no solo el cambio
  técnico.

---

## 6. Trampas conocidas (ya nos costaron)

- **`SesionPage` se remonta con `key={sesionId}`** (`SesionPage.tsx:55`). La ruta
  reutiliza el mismo elemento, así que sin ese `key` el estado de la sesión vieja
  se escribía sobre la clave de la nueva. No quitarlo.
- **`onAuthStateChange` dispara `SIGNED_IN` en cada refoco** de la app, no solo al
  iniciar sesión. Tratarlo como «ya hay sesión», no como «acaba de entrar», o la UI
  se desmonta cada vez que el asesorado vuelve a la app.
- **La persistencia por sesión se lee con `useState(() => leerJSON(…))`**, que solo
  corre en el primer montaje. Si añades estado persistido y la clave depende de un
  parámetro de ruta, asegúrate del remontaje.

---

## 7. Skills y permisos

Dos skills de ingeniería en `.claude/skills/`, además de las de diseño y animación que
ya había:

- **`verificar-contra-la-realidad`** — antes de afirmar que algo está aplicado,
  arreglado o desplegado, comprobarlo contra la fuente real. En este proyecto el repo
  **no** es la realidad: las migraciones se aplican a mano y los tests no ven píxeles.
- **`tests-primero-sin-cobertura`** — cómo tocar un archivo de `src/` que no tiene
  tests: escribirlos primero y comprobarlos contra el código viejo.

`.claude/settings.json` deja pasar sin preguntar lo que es de lectura o verificación
(`npm run verify`, `git status`, `git diff`…) y **bloquea la lectura de los archivos con
credenciales** (`.env.local`, `CLAVES.local.txt`, los `*.local.sql` y las cargas de
asesorados). También bloquea `push --force` y `reset --hard`. Todo lo demás pregunta,
que es lo que se quiere: la fricción está donde hay riesgo, no en lo rutinario.

## 8. Dónde está el conocimiento

- **Cómo está construido el software y cómo se repara:**
  `../../Cerebro Programacion Alpha/wiki/` — protocolos, conceptos e **incidentes
  reales** (raíz → solución → prevención). Consultar `wiki/index.md` antes de
  diagnosticar un fallo: puede que ya esté archivado.
- **Qué programar para el asesorado** (entrenamiento y nutrición, método Heracles):
  `../` (Cerebro Alpha), en `wiki/motor-decision/`.
