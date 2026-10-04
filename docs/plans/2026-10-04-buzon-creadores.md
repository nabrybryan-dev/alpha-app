# Plan · Buzón de creadores (4-oct-2026)

Diseño: `docs/specs/2026-10-04-buzon-creadores-diseno.md`. Cada paso termina con `npm run verify` y
las pruebas SQL en verde. Todo va en un PR en borrador: nada se aplica ni se despliega sin la
casilla de Bryan.

| # | Paso | Listo cuando |
|---|---|---|
| 1 | **Prueba SQL primero** (`supabase/test/214-buzon-creadores.sql`): lo que `anon`, `authenticated` sin capacidad, el staff y `service_role` pueden y no pueden hacer | Falla contra `main` por las razones esperadas (las tablas no existen) |
| 2 | **Migración** (el siguiente número libre al construir; hoy sería la 0112): dos tablas con RLS en el mismo paso, el bucket privado con límites, cuatro funciones con `search_path` fijo y `revoke`, y sus señales en `comprobar-migraciones.sql` | La prueba del paso 1 pasa, y `comprobar-migraciones.sql` se ejecuta entera con las señales nuevas en SI |
| 3 | **Edge Function** `buzon-creador`, un solo archivo como `salud-atajo`, con sus pruebas vitest y un doble del almacén | 401/413/422/429 cubiertos; la ruta la decide el servidor; nada sensible en los registros |
| 4 | **Capa de datos** `src/data/consola/buzon.ts` (la UI no habla con Supabase directo) y **dominio** `src/domain/creadores/buzon.ts` (validar el tipo y el tamaño, armar el enlace) con sus `.test.ts` | Pruebas en verde; en modo demo devuelve un estado fijo |
| 5 | **Consola:** en la ficha del creador, «Generar enlace / Revocar» (solo el coach) y la lista de lo recibido (con `revisar_creadores`) | Pruebas de componente: el asesorado y Manuela sin capacidad no ven nada |
| 6 | **Página pública** `/buzon`: la frontera, el botón de subir y el progreso «N de M» | Prueba de componente: nunca pinta nombres de archivos ni datos del creador |
| 7 | **Pasos para Bryan** en el PR: aplicar la migración, crear la función con `--no-verify-jwt`, comprobar las señales, y la adenda con la frontera y la conservación | — |

Bloqueos conocidos: la conservación (`FALTA`, con el valor por defecto del diseño) y la adenda del
acuerdo, que firma Bryan. Ninguno impide construir los pasos 1 a 6.
