# La cola de trabajos: la que ya tienes, y cómo añadirle uno

**Fecha:** 2026-08-27
**Estado:** documentación de lo existente, sin cambios de código

---

## La respuesta corta

**No hace falta montar BullMQ, Celery ni Sidekiq, y no se pueden montar.** Esta
app no tiene servidor propio: es un SPA de Vite servido por Vercel que habla
directo con Supabase. No hay ningún proceso nuestro corriendo en ningún sitio
donde pudiera vivir un *worker*.

Lo que sí hay, y lleva tiempo en producción:

| pieza | dónde | qué hace |
|---|---|---|
| **La cola** | `src/data/nube/cola.ts` | Guarda en `localStorage` lo que falta por subir |
| **El worker** | `src/data/nube/procesador.ts` | La vacía contra Supabase, con reintentos |
| **Los descartes** | `apartarDescartadas()` (`cola.ts:157`) | Donde caen los que fallan de plano |
| **El cron** | `pg_cron`, migración 0048 | Trabajo periódico en el servidor |
| **Trabajo en servidor** | Edge Functions (`supabase/functions/`) | Lo que no puede correr en el móvil |

Y hay una razón por la que esto es **mejor** que Redis aquí, no un apaño: la cola
vive en el dispositivo, así que **funciona sin conexión**. El caso real de esta
app es una asesorada registrando series en un gimnasio con mal wifi. Una cola en
Redis exige que el móvil llegue al servidor para encolar; ésta no.

## Lo que pide un sistema de colas, y dónde está aquí

### Encolar sin que la persona espere

```ts
encolar({ tabla: 'checkins', tipo: 'upsert', payload: fila })
```

`encolar()` (`procesador.ts`) escribe en `localStorage` y lanza el procesado con
`void procesarCola()` — **sin `await`**. Quien pulsó el botón sigue su camino.

### Reintentos

`MAX_INTENTOS = 8` (`cola.ts:59`). Cada operación se lleva su cuenta de intentos
encima, así que sobrevive a cerrar la app.

Con un matiz medido: **estar sin conexión no cuenta como intento**
(`procesador.ts`). Estar offline durante un entreno entero no puede terminar
descartando las series registradas.

### Que un reintento no duplique el efecto

Esto es el «no mandes el mismo correo dos veces», y aquí está resuelto **en la
base, no en la memoria del proceso**:

- Las filas llevan `cliente_id`, un identificador que genera el móvil.
- Suben con `upsert ... on conflict (cliente_id)`.

Reintentar la misma operación escribe encima de la misma fila. No hay segunda.

> **Ojo con los índices de `cliente_id`:** no pueden ser parciales. Un
> `ON CONFLICT (cliente_id)` no puede arbitrar sobre un índice con `where`, y
> mientras lo fueron cada comida registrada falló con `42P10` y se descartó **en
> silencio**. Lo arregló la migración 0023.

Y hay una segunda defensa contra el trabajo repetido: `claveRpc` colapsa
operaciones equivalentes que aún no han salido. Cuatro series del mismo ejercicio
dejan **una** operación en cola, no cuatro, porque cada una manda el array
completo de ese ejercicio.

### Dead-letter

`apartarDescartadas()` recoge lo que agota los ocho intentos —fila inexistente,
RLS que lo rechaza— en vez de perderlo. Se aparta para que no bloquee
eternamente lo que viene detrás, y queda a la vista.

### Y una que los manuales no piden

`drenar()` **vuelve a leer `localStorage` en cada vuelta** en lugar de trabajar
sobre la foto tomada al empezar. Sin eso, todo lo que la persona encolara durante
una subida lenta se sobrescribía al terminar: ni se subía, ni se reintentaba, ni
quedaba en descartes. Desaparecía.

## El molde: añadir un trabajo nuevo

Los tres tipos que entiende `OperacionPendiente` (`cola.ts:15`):

```ts
// 1. Escribir o reemplazar una fila entera.
encolar({
  tabla: 'checkins',
  tipo: 'upsert',
  payload: { cliente_id: idLocal, usuario_id: yo, fecha, datos },
  onConflict: 'cliente_id',   // sin esto, Supabase usa la clave primaria
})

// 2. Cambiar unos campos de una fila que ya existe.
encolar({
  tabla: 'mensajes',
  tipo: 'update',
  payload: { leido: true },
  filtro: { id: mensajeId },
})

// 3. Que el servidor haga algo que PostgREST no sabe hacer.
//    Los parámetros van con prefijo `p_`, como en `fijar_series_ejercicio` y
//    `fijar_test_post`, que son las dos que existen hoy (`sync.ts`).
encolar({
  tabla: 'microciclos',
  tipo: 'rpc',
  funcion: 'fijar_series_ejercicio',
  claveRpc: `${microcicloId}:${ejercicioId}`,   // colapsa las repetidas
  payload: { p_microciclo_id: microcicloId, p_ejercicio_id: ejercicioId, p_series: series },
})
```

El tipo `rpc` existe porque **PostgREST no sabe escribir dentro de un JSONB**:
para tocar una rama de `microciclos.datos` sin mandar el blob entero hace falta
que el servidor haga el `jsonb_set`. Ver la migración 0037 y
`docs/specs/2026-08-15-subir-solo-lo-que-cambia.md`.

### La lista de comprobación al añadir uno

1. ¿La fila lleva `cliente_id` y el `onConflict` correspondiente? Si no,
   reintentar duplica.
2. Si es `rpc` y puede repetirse, ¿tiene `claveRpc`?
3. ¿La función del servidor tiene `revoke execute ... from public`? `create
   function` concede `EXECUTE` a `PUBLIC` por defecto, y todo lo de `public` se
   expone como RPC a `anon`. Una función que **escribe** queda al alcance de la
   anon key.
4. ¿Hay test de que sobrevive a estar sin conexión? El patrón está en
   `src/data/nube/perdida-datos.test.ts`.

## Cómo se «levanta el worker»

**En local y en producción: no se levanta.** No es un proceso.

- `procesarCola()` corre **dentro de la pestaña**, disparado por `encolar()` y
  por la hidratación. Abrir la app es arrancar el worker.
- Para verlo trabajar: DevTools → Application → Local Storage, clave
  **`alpha-cola-sync`**, mientras se registra algo con el modo avión puesto.
- `colaEnReposo()` es el punto de espera cuando hace falta un estado conocido —
  los tests entre casos, o un cierre de sesión que va a borrarla.

### Lo que sí corre en el servidor

- **`pg_cron`** (activo desde la 0048): refresca la vista del ranking cada 10
  minutos. Para añadir otro periódico:
  ```sql
  select cron.schedule('nombre', '*/10 * * * *', $$select public.mi_funcion();$$);
  select jobname, schedule, active from cron.job;   -- comprobar
  ```
  Con una advertencia que ya está escrita en la 0048: **un cron que deja de
  correr no da error**. Si lo que refresca puede quedarse viejo, hay que poner un
  sello de tiempo y que quien lea decida — como hace `ranking_disciplina()`, que
  vuelve al cálculo en vivo si el último refresco pasa de 30 minutos.

- **Edge Functions** (`supabase/functions/`): hoy solo `responder-chat`. Es donde
  va lo que necesita una clave que no puede estar en el móvil.

## Cuándo sí habría que replantearlo

Cuando aparezca trabajo que **no puede depender de que alguien tenga la app
abierta**: mandar correos, generar un PDF de informe, un aviso programado. Nada
de eso existe hoy. Cuando exista, la herramienta no será Redis: será una Edge
Function disparada por `pg_cron`, que es infraestructura que ya está pagada y
corriendo.
