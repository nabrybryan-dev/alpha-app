# 2026-09-13 · El veto de 24 horas

> Decisión del dueño (13-sep): «Solo con 24 h de veto». Todo plan terminado entra en una bandeja durante 24 horas; si nadie lo para, se publica solo. Un plan que trae `parada` nunca se publica solo.

## 1. Qué problema resuelve

Hoy la cadena deja un JSON terminado y alguien lo carga a mano con `tmp_cargar_siguiente` (o variante). El cuello de botella es humano y la carga es inmediata: un plan con aviso entra igual si nadie mira a tiempo.

Lo que se quiere:

- Que la cadena pueda terminar sin esperar a nadie.
- Que el coach tenga una ventana real para mirar y parar.
- Que lo que tenga marca clínica de parada no entre nunca por el cron.

## 2. Dónde vive cada cosa

| Capa | Objeto | Rol |
|------|--------|-----|
| `public.microciclos` | `id, usuario_id, numero, estado, datos jsonb, actualizado_en` | Fuente de verdad del microciclo activo. `estado` manda; trigger borra `estado` del blob. Índice único parcial `microciclos_un_activo_por_usuario` (0069) impide dos activos. |
| `public.publicaciones_pendientes` | Ver §3 | Bandeja del veto. Solo la ve el staff. |
| App (`src/features/coach/`) | `BandejaVeto.tsx` + `useBandejaVeto.ts` | Lista "Planes que salen solos" con cuenta atrás y botón Parar. |
| Base (`publicar_pendientes`, `parar_publicacion`) | Funciones `SECURITY DEFINER` | Publicar vencidas / parar una fila. |
| Infra (`pg_cron`) | `cron.schedule` cada 15 min | Llama a `publicar_pendientes()`. |

El microciclo propuesto no existe como estado distinto en esta bandeja: lo que entra es el JSON ya terminado tal como la cadena lo deja, con `avisos` y `trae_parada`.

## 3. Tabla `publicaciones_pendientes`

```sql
publicaciones_pendientes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references usuarios_app(id) on delete cascade,
  microciclo_id text not null,          -- id destino, p. ej. m-ana-12
  id_anterior   text,                   -- id del activo que se espera cerrar (puede ser null si sin activo)
  datos         jsonb not null,         -- el microciclo tal como debe insertarse en microciclos.datos (ya pasado por tmp_nuevo_micro / tmp_sesion_en_limpio: sin hechoEn/testPost/fecha/empezadaEn/ultimaMarcaEn, series a [], escenarios y seriesPrescritas conservados)
  avisos        jsonb not null default '[]'::jsonb,  -- lista de avisos tal como la produce la cadena (para pintar arriba)
  trae_parada   boolean not null default false,       -- si true, NUNCA publica solo
  creado_en     timestamptz not null default now(),
  publicar_en   timestamptz not null generated always as (creado_en + interval '24 hours') stored,
  estado        text not null default 'pendiente' check (estado in ('pendiente','parado','publicado','fallido')),
  parado_por    uuid references usuarios_app(id),
  motivo        text,
  publicado_en  timestamptz
)
```

Índices: `(estado, publicar_en)` para el barrido del cron; `(usuario_id)` para la bandeja.

Columna `publicar_en` es generada o con default `creado_en + 24h` si no se quiere generated. Se documenta como expresión para que un `INSERT` sin `publicar_en` calcule solo.

## 4. Estados

```
pendiente ──(24h sin veto)──▶ publicado
    │  (parar_publicacion)      │
    ├──▶ parado                 └── idempotente si se vuelve a llamar
    └──(trae_parada)──▶ no publica, queda pendiente hasta que alguien lo pare o lo publique a mano
    └──(activo actual != id_anterior)──▶ fallido (con motivo)
    └──(publicar_pendientes idempotente)──▶ no duplica
```

- `pendiente`: en bandeja, con cuenta atrás.
- `parado`: alguien del staff lo paró. `parado_por`, `motivo`, `publicado_en = null`.
- `publicado`: ya está en `microciclos` como activo. `publicado_en` con hora.
- `fallido`: se intentó publicar y no se pudo (p. ej. el activo actual ya no es `id_anterior`). Lleva `motivo`. No reintenta solo; requiere acción del coach.

Transiciones permitidas: `pendiente → parado | publicado | fallido`. Las demás no existen. `parado`, `publicado`, `fallido` son terminales para el cron (no los vuelve a tocar).

## 5. Quién puede qué (RLS)

Principio: lo que entra lo escribe la cadena con `service_role`; lo que se ve y se para lo hace el staff con `authenticated`.

| Operación | Rol | Política |
|-----------|-----|----------|
| `SELECT` | `authenticated` con `es_staff()` | `publicaciones_pendientes_lee_staff` |
| `INSERT` | `service_role` | política `for insert to service_role` (o `authenticated` con check `es_staff()` si la cadena usa JWT de staff; preferido: solo `service_role`) |
| `UPDATE` (parar) | Solo vía `parar_publicacion()` (`SECURITY DEFINER`) que comprueba `es_staff()` | Sin política de `UPDATE` directa a `authenticated` sobre `estado/motivo` |
| `DELETE` | Nadie (`authenticated` no borra) | Sin política de delete |
| `anon` | Nada | `revoke all ... from anon, public` |

La bandeja no se escribe desde la app del asesorado. Un asesorado que llame por RPC no ve la tabla (RLS) y no puede publicar ni parar.

## 6. Qué pasa con `parada`

Invariante no negociable: **un plan con `trae_parada = true` nunca se publica solo**, aunque venza.

- Al `INSERT`, la cadena marca `trae_parada` según la zona clínica que produce el dictamen (p. ej. `I-23`, `I-30`, `cribado` en zona roja, `reevaluacion` que vence y para). Si la cadena no lo marca, el trigger/función de publicación lo recalcula como guarda.
- `publicar_pendientes()` filtra `where trae_parada = false`. Las filas con `trae_parada` quedan `pendiente` indefinidamente hasta que el coach las pare (`parado`) o las publique a mano por otro camino (fuera de esta bandeja).
- No se marca `fallido` por `trae_parada`: es una espera, no un error. `fallido` es para el caso id_anterior.
- Auditoría: la bandeja muestra `trae_parada` destacado y el `motivo` clínico si viene en `avisos`.

Si la cadena olvidara marcar `trae_parada` y el plan realmente la trae, el riesgo es que se publique. Por eso la publicación también comprueba señal clínica mínima en `datos`/`avisos` como segunda red (ver migración).

## 7. Qué pasa si al publicar la persona ya tiene otro activo distinto del esperado

`id_anterior` es el `id` del microciclo activo que había cuando la cadena preparó la bandeja. Al publicar:

1. Se lee el activo actual de `usuario_id` (`where estado='activo'`).
2. Si hay uno y su `id != id_anterior`, **no se publica**. La fila pasa a `fallido` con `motivo = 'activo distinto: se esperaba ' || id_anterior || ' y hay ' || activo_actual`.
3. Si hay varios activos (estado roto), también `fallido` con motivo de cardinalidad.
4. Si no hay activo y `id_anterior` era null, se publica normal (primer microciclo).
5. Si no hay activo pero `id_anterior` no era null, `fallido` con motivo de activo perdido.

En ningún caso se insertan dos activos: la publicación corre en transacción por fila, cierra el anterior y abre el nuevo en el mismo bloque (reusa el orden de `activar_microciclo` / `tmp_cargar_siguiente`: cerrar antes de abrir, y red de `count(*) = 1`).

`fallido` no reintenta solo. El coach ve el motivo en la bandeja y decide (reprogramar, descartar, o empujar a mano).

## 8. Cómo se deshace

- **Parar antes de publicar:** `select parar_publicacion(id, 'motivo')`. Pasa a `parado`.
- **Publicado por error:** no hay "despublicar" automático. Se revierte como cualquier microciclo: `update microciclos set estado='cerrado' where id = :publicado; update microciclos set estado='activo' where id = :anterior;` o `select activar_microciclo(:id_anterior)` si existe. La fila de bandeja queda `publicado` con su `publicado_en`; no se borra (auditoría). Si se quiere, se añade un `motivo` de reversión en nota aparte.
- **Fallido:** corregir `id_anterior` o el activo y reinsertar una nueva fila `pendiente` (no se recicla la fallida).
- **Índice/cron:** `drop index`, `select cron.unschedule('publicar-pendientes-cada-15')` si hiciera falta. Sin cron, nada se publica solo; la bandeja sigue visible.

## 9. Reutilización del clonador

La cadena debe producir `datos` ya limpio: sin `hechoEn`, sin `testPost`, sin `fecha`/`empezadaEn`/`ultimaMarcaEn`, con `series: []`, conservando `escenarios` y `seriesPrescritas` (salvo cuando el ajuste invalida), y sin `estado` en el blob (lo borra el trigger `trg_sin_estado_en_el_blob`). Es decir, lo que hoy hace `tmp_nuevo_micro(tmp_sesion_en_limpio(...))`.

La función `publicar_pendientes()` **reaplica** esa limpieza por defensa (idempotente y barata) antes de insertar, para que un JSON que venga sin pasar por el molde no herede ejecución.

## 10. Qué falta para que la cadena escriba en la bandeja en vez de cargar

Hoy la cadena escribe un microciclo terminado y alguien lo carga a mano. Para que escriba en la bandeja:

- Otro repo (tubería) debe cambiar su paso final: en vez de `tmp_cargar_siguiente` / `insert into microciclos ... estado='activo'`, hace `insert into publicaciones_pendientes (usuario_id, microciclo_id, id_anterior, datos, avisos, trae_parada) values (...)` con `service_role`.
- `id_anterior` se toma leyendo `select id from microciclos where usuario_id=:uid and estado='activo'` en ese momento.
- `trae_parada` y `avisos` salen del dictamen clínico ya existente (I-23 / I-30 / cribado).
- Esta app solo añade la bandeja y el cron; no toca la cadena. El cambio de la cadena es un PR en su repo, con su test de que no trae `hechoEn` ni `estado` en el blob.

## 11. Verificación

- `supabase/comprobar-migraciones.sql` añade señales para la tabla, RLS, funciones y cron.
- `supabase/test/NN-veto-24h.sql` prueba local: publica vencida, no publica parada, no publica trae_parada, no publica si activo != id_anterior, idempotencia.

## 12. Riesgos

- Un plan con aviso entra si nadie mira en 24 h. Riesgo aceptado por el dueño. Mitigación: la bandeja ordena por urgencia y muestra avisos arriba.
- Si la cadena olvida `trae_parada`, el cron podría publicar un plan que debía quedarse. Mitigación: segunda comprobación clínica en `publicar_pendientes()` y test que la cubre.
- Reloj: `publicar_en` usa `now()` del servidor. Deriva pequeña no importa; la ventana es de 24 h y el cron corre cada 15 min.
