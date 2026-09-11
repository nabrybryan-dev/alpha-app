# Plan: el sexo en la ficha

Spec: `docs/specs/2026-09-06-el-sexo-en-la-ficha.md`.

Cada paso deja `npm run verify` en verde. Los guardianes nuevos se vieron en rojo con una
mutación antes de darlos por buenos (constante renombrada, `check` con un valor de más,
salón sin la prop).

1. **Dominio.** `SexoDeFicha` y `Perfil.sexo?` en `types.ts`; la lista y la comprobación
   en `src/domain/sexoDeFicha.ts` (+ test). La `'M'` de la encuesta de nutrición NO es un
   sexo de ficha, y el test lo dice.
2. **La columna, en un solo sitio.** `src/data/nube/perfilEnNube.ts`: `COLUMNA_SEXO`,
   `SELECCION_PERFILES`, las dos filas que suben (coach con columna, asesorado sin ella),
   `datosDePerfil` y `perfilesDe` con el respaldo del servidor. `perfilEnNube.test.ts`
   cruza la constante con el SQL de las migraciones y con los envíos de `sync.ts`.
3. **Migración `0056`** — la columna con `check`, `proteger_perfil` ampliado, RLS sin
   tocar. Señal en `comprobar-migraciones.sql`. Casos 7–10 en
   `supabase/test/10-escrituras-del-asesorado.sql` (los corre el Postgres del CI).
4. **Repositorio y sync.** `guardarSexo` en `repos.ts`, `mockDb.ts` (+ test) y
   `sync.ts`; `subirPerfil` distingue quién escribe; `hidratar.ts` pide
   `SELECCION_PERFILES` y pasa por `perfilesDe`. `sexo-en-la-ficha-sync.test.ts`.
5. **Seed de demo.** Valentina y Sara mujer, Mateo hombre.
6. **Pantalla del coach.** `SexoDeLaFicha.tsx` (Hombre / Mujer / Sin indicar, con
   palabras) montado en el Resumen de `AsesoradoDetallePage` (+ test).
7. **El visor lo lee.** `SalonEntrenar` recibe `sexo` y se lo da a `VisorPatron`;
   `RutaPage` lo lee de la ficha. `EstudioDelPatron` lo pasa al visor y al explorador
   como `sexoInicial`; `SesionPage` lo lee de la ficha. Tests:
   `salon/sexo-prop-al-visor.test.tsx`, `visor/EstudioDelPatron.sexo.test.tsx`,
   `ExploradorAnatomico.test.tsx`.
8. `npm run verify`; linter con los mismos avisos que antes.

Fuera de este plan, a propósito: el defecto del visor y de `juegoDeHuesos` (otra sesión),
`VisorPatron.tsx`, `src/domain/patrones/`, `scripts/atlas/` y `public/piezas/`.
