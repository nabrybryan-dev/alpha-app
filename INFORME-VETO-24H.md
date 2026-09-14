# INFORME — El veto de 24 horas (2026-09-13)

> Encargo del 13-sep: «Solo con 24 h de veto». La cadena deja el plan terminado en una bandeja; durante 24 h el coach ve cuenta atrás y puede parar; si nadie lo para, se publica solo. Un plan que trae parada nunca se publica solo.

Rama: `feat/veto-24h` (worktree `F:\dev\alpha-veto-24h` desde `origin/main`).

---

## Qué se hizo

### A) Espec — `docs/specs/2026-09-13-el-veto-de-24-horas.md`

12 secciones. Define: tabla DDL con `publicar_en` generada (`creado_en + 24h`), diagrama de estados (`pendiente | parado | publicado | fallido`), RLS (solo staff lee; service_role inserta; parar solo por `SECURITY DEFINER`), invariante `trae_parada` (nunca auto-publica, queda pendiente), regla `id_anterior` (activo actual distinto → `fallido` con motivo), deshacer (parar antes / revertir activo / fallido reinsertando), reuso del clonador (`tmp_sesion_en_limpio`/`tmp_nuevo_micro`), qué falta para que la cadena escriba en bandeja y riesgos.

### B) Base — `supabase/migrations/NNNN_el_veto_de_24_horas.sql` (literal NNNN)

Conjunto inseparable para no dejar la bandeja a medias:

- Tabla `public.publicaciones_pendientes` con `publicar_en timestamptz generated always as (creado_en + interval '24h') stored`, índices `(estado, publicar_en) where pendiente` y `(usuario_id)`, `enable row level security` en el mismo `create table`.
- RLS `publicaciones_pendientes_lee_staff` (`using ((select public.es_staff()))` a `authenticated`), `revoke all ... from anon, public`, `grant select to authenticated`, `grant all to service_role`. Sin política de UPDATE directa: parar solo por función.
- Helpers permanentes `veto_sin_marcas`, `veto_sesion_en_limpio`, `veto_datos_en_limpio` (reuso defensivo del molde `supabase/plantilla-carga-microciclo.sql`: borran `hechoEn/testPost/fecha/empezadaEn/ultimaMarcaEn`, ponen `series: []`, conservan `escenarios`/`seriesPrescritas`, quitan `estado` del blob). `revoke execute ... from public, anon` en cada una.
- `publicar_pendientes()` `SECURITY DEFINER` idempotente. Filtra `pendiente && !trae_parada && publicar_en <= now()`, segunda red `avisos::text ilike '%parada%'` → `continue` (queda pendiente, no fallido), verifica `id_anterior` contra activo actual (`count(*)`, `is distinct from`, caso sin activo / multi-activo) → `fallido` con motivo, reaplica `veto_datos_en_limpio` + `jsonb_build_object('id', microciclo_id)`, cierra antes de abrir (mismo orden que `activar_microciclo`), `insert ... on conflict (id) do update`, verifica `count(*) = 1` activo tras insert, `update ... set estado='publicado'`. Excepción por fila → `fallido` con `left(SQLERRM,500)`. `revoke ... from public, anon`, `grant execute to authenticated, service_role`.
- `parar_publicacion(p_id uuid, p_motivo text)` `SECURITY DEFINER` con `if not public.es_staff() then raise 'solo staff'`. `update ... where estado='pendiente'` a `parado` con `parado_por = auth.uid()`.
- `pg_cron` cada 15 min (`cron.schedule('publicar-pendientes-cada-15','*/15 * * * *','select public.publicar_pendientes();')`) en bloque `do $cron_veto$` con guarda `pg_available_extensions`; fuera de transacción (patrón 0048). Sin cron, no hay publicación automática; la bandeja sigue visible.

Señales añadidas a `supabase/comprobar-migraciones.sql` (NNNN): tabla RLS, funciones definer, cron.

### C) Prueba SQL — `supabase/test/50-el-veto-de-24-horas.sql`

Corre en local (harness `00-suplantar-supabase.sql`, sin tocar Supabase real). Cubre los cinco casos del encargo más limpieza:

1. Vencida sin parada y con `id_anterior` correcto → publica (pasa a `publicado`, microciclo activo con limpieza re-aplicada).
2. Parada vía `parar_publicacion` (con `pruebas.soy` + `set role authenticated` + `exigir_rls`) → no publica aunque venza.
3. `trae_parada = true` sin estar parada → queda `pendiente` tras cron.
4. Activo actual distinto de `id_anterior` → `fallido` con motivo «se esperaba X y hay Y».
5. Repetir `publicar_pendientes()` no duplica (idempotente: segunda pasada no re-publica ya-publicados ni re-falla).
6. Fósiles: JSON de bandeja con `hechoEn/testPost/fecha/empezadaEn/ultimaMarcaEn/series` sucios → microciclo publicado limpio (mismo criterio que `supabase/comprobar-fosiles.sql`).

Verificación SQL esperada tras aplicar: `psql < supabase/test/50-el-veto-de-24-horas.sql` sin `raise` (todas las `pruebas.afirmar` en verde, 0 microciclos fósiles).

### D) Panel del coach

- `src/data/nube/bandejaVetoNube.ts` no existe: la capa elegida es `src/features/coach/bandejaVetoNube.ts` (separa nube de vista como `consultasNube.ts`): `leerBandeja()` (`select ... eq estado='pendiente' order by publicar_en` + segunda consulta `usuarios_app in ids` para nombres, reserva `usuarioId` si falla) y `pararPublicacion(id,motivo)` (`rpc parar_publicacion`). Helpers puros `msRestantes`/`textoCuentaAtras` (minutos/horas/vencida) para cuenta atrás sin refetch.
- `src/features/coach/BandejaVeto.tsx`: Card «Planes que salen solos» (kicker Veto de 24 h, frase «La cadena los dejó en bandeja…»). Si no hay filas, no pinta nada. Si `modoNube=false` enseña «La bandeja lee de Supabase…» con error; con nube: estados `cargando`/`error` con Reintentar, `listo` con cabecera + `Actualizar` + aviso de `Parado/No se pudo parar`. Cada fila: avisos arriba (`ul`, `textoAviso` acepta string o `{mensaje/texto}`), persona + badge `M{numero}` + badge rojo `trae parada` cuando toca + badge cuenta atrás (ámbar/rojo) via `textoCuentaAtras`, fila de acciones `Ver plan` → `/coach/asesorado/:usuarioId` y `Parar` (flujo cerrado→abierto con input Motivo + Confirmar/Cancelar; `parando` deshabilita). Cuenta atrás se mueve cada 60 s con `setInterval` sin refetch.
- `src/features/coach/AsesoradosPage.tsx`: inserta `<BandejaVeto />` tras `<PanelMicrociclos />` (flex `gap-4`), antes de la cartera. No toca `Semaforo`/resúmenes.
- `src/features/coach/BandejaVeto.test.tsx` (7 tests, todos en verde a 2026-09-13 19:15): mock de `bandejaVetoNube` (no de `supabase()` directo) + modoNube stub, cubren lectura fallida con Reintentar, listado de persona/micro/avisos/cuenta/Ver plan href/Parar, vencida, `trae_parada` badge, Parar pide motivo y saca fila con aviso «Parado…», parar fallido no saca y muestra error, sin pendientes no renderiza la Card.

### E) Informe (este archivo)

---

## Commits

Los commits se hacen con `git commit --only <rutas>` (rutas explícitas, sin `--all`).

Previstos / realizados sobre `feat/veto-24h`:

1. `feat(veto): spec 2026-09-13 y migración NNNN con bandeja, RLS y cron cada 15` — `docs/specs/2026-09-13-el-veto-de-24-horas.md`, `supabase/migrations/NNNN_el_veto_de_24_horas.sql`, `supabase/comprobar-migraciones.sql`, `supabase/test/50-el-veto-de-24-horas.sql`
2. `feat(veto): panel del coach Planes que salen solos con Veto 24h y Parar` — `src/features/coach/bandejaVetoNube.ts`, `src/features/coach/BandejaVeto.tsx`, `src/features/coach/BandejaVeto.test.tsx`, `src/features/coach/AsesoradosPage.tsx`
3. `docs(veto): INFORME-VETO-24H.md` — `INFORME-VETO-24H.md`

> Si lees este informe antes de que los commits aparezcan en `git log`, es porque el commit 3 aún no se aplicó; el contenido ya está en disco.

Historial previo de la rama (base):

```
40aff16 fix(revision): la cara sobre una voz ya firmada vuelve a la bandeja (#295)
12a28c5 fix(revision): el registro del viernes tiene un solo escritor, y el script corre su version nueva (#294)
0704065 Merge ...
```

---

## Tests y salida resumida

> Regla del encargo: `npm ci` y tests por archivo; poca memoria, nada de la suite entera en paralelo.

```
npm ci                         → 708 paquetes (ok)
npm run typecheck (tsc -b)     → 0 errores
npx vitest run src/features/coach/BandejaVeto.test.tsx
  → 7 passed (7), 0 failed — 19:15 (duración ~1.6s)
     · si la lectura falla, lo dice y ofrece reintentar
     · lista persona, microciclo, avisos arriba, cuenta atrás, Ver plan y Parar
     · la cuenta atrás dice vencida cuando ya pasó la hora
     · trae_parada muestra el badge y no oculta la fila
     · Parar pide motivo y al confirmar llama parar_publicacion y saca la fila
     · si parar falla, no saca la fila y enseña el error
     · sin pendientes no renderiza nada (no enseña "0 planes")
supabase/test/50-el-veto-de-24-horas.sql
  → pensado para psql local con el harness 00-suplantar-supabase.sql;
     no se corre en CI (requiere Postgres/Supabase). Tras `NNNN...sql`
     aplicado, cubre: publica vencida, no publica parada, no publica
     trae_parada, no publica si activo != id_anterior (fallido), idempotencia,
     y limpieza de fósiles.
```

No se corrió `npm run verify` completo (typecheck+lint+suite entera) en esta sesión por límite de memoria del encargo; se verificó por archivo (`npx vitest run <archivo>` + `npm run typecheck`). No se usó `gh`, no se hizo `git push`, no se tocó Supabase real.

---

## Qué falta para que la cadena escriba en la bandeja en vez de cargar

Esta entrega hace la bandeja y el cron; **no toca la cadena** (vive en otro repo). El cambio que falta es un PR en ese repo, solo descrito aquí:

- Paso final de la tubería hoy: arma el microciclo con `tmp_nuevo_micro(tmp_sesion_en_limpio(...))` y hace `insert into microciclos ... estado='activo'` o `select tmp_cargar_siguiente(...)` (con su `coalesce(jsonb_agg,'[]')`, close-before-open, verificación `count=1`). Eso desaparece como inserción directa.
- Nuevo paso final: con `service_role` hace
  ```sql
  -- id_anterior = activo actual en ese momento (puede ser null)
  select id into :id_anterior from microciclos where usuario_id=:uid and estado='activo' limit 1;
  insert into publicaciones_pendientes
    (usuario_id, microciclo_id, id_anterior, datos, avisos, trae_parada)
  values
    (:uid, :microciclo_id, :id_anterior, :datos_limpio, :avisos, :trae_parada);
  ```
  `:datos_limpio` ya viene de `tmp_nuevo_micro(tmp_sesion_en_limpio(...))` pasado por `veto_datos_en_limpio` si hiciera falta; sin `estado` en el blob (lo borra el trigger 0066). `:avisos` es el array tal como lo produce la cadena (arriba en el panel). `:trae_parada` sale de la zona clínica del dictamen (I-23/I-30/cribado en rojo, reevaluación que vence y para); la publicación además revisa `avisos ilike '%parada%'` como segunda red.
- El repo de la cadena debe añadir test de que lo que inserta en `publicaciones_pendientes.datos` no trae `hechoEn/testPost/fecha/empezadaEn/ultimaMarcaEn/series` fósiles ni `estado` en el blob, igual que `50-el-veto-de-24-horas.sql` §6 lo comprueba del lado receptor.
- Despliegue: aplicar `NNNN_el_veto_de_24_horas.sql` a mano en el SQL Editor (no hay registro de versiones), comprobar con `supabase/comprobar-migraciones.sql` y con `supabase/comprobar-fosiles.sql` tras la primera publicación automática. El `cron.schedule` lo crea la propia migración si `pg_cron` existe; en local sin extensión queda aviso y sin publicación automática.

Nada de esto se hace desde `alpha-veto-24h`; aquí solo se deja la bandeja lista para recibir.

---

## Riesgos

- **Trae_parada olvidada por la cadena.** Si la cadena no marca `trae_parada` y el plan debía quedarse, el cron podría publicarlo vencido. Mitiga la segunda red `avisos ilike '%parada%'` y el badge rojo, pero lo correcto es que la cadena lo marque fiable (PR de la cadena con test de fósiles/`estado`).
- **Ventana de 24 h sin ojos.** Un plan con aviso que nadie mira en 24 h entra solo; es el riesgo aceptado por el dueño. Mitiga ordenar por `publicar_en` ascendente y pintar avisos arriba, con cuenta atrás visible.
- **`id_anterior` desfasado por edición manual.** Si alguien cambia el activo a mano entre el `insert` en bandeja y el vencimiento, la publicación no fuerza: marca `fallido` con motivo «se esperaba X y hay Y». Requiere que el coach decida (no reintenta solo).
- **Reloj.** `publicar_en = creado_en + 24h` usa `now()` del servidor; deriva pequeña no importa (barrido cada 15 min, ventana en horas). Si `pg_cron` no está habilitado (p. ej. local), no hay publicación automática; la bandeja queda para acción manual.
- **RLS mal aplicada en auxiliares.** Toda tabla auxiliar de limpieza que se cree debe llevar `enable row level security` en el mismo `create table`; sin RLS queda legible con la anon key. La bandeja ya lo lleva, y las funciones llevan `revoke execute from public, anon`.
- **`publicar_pendientes` sin test contra Supabase real.** La prueba SQL usa el harness local (`00-suplantar-supabase.sql`); no sustituye a una pasada contra un proyecto Supabase de prueba con roles reales y `pg_cron` habilitado. Conviene esa pasada antes de dar por cerrado el flujo.

---

## Si algo bloquea

Nada bloquea la entrega en disco a 2026-09-13. Queda pendiente el commit de este informe y la pasada manual de `NNNN_el_veto_de_24_horas.sql` + `50-el-veto-de-24-horas.sql` en un Supabase de prueba con `pg_cron` habilitado para confirmar el cron real.
