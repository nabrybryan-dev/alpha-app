# 2026-09-13 — Aviso diario y check-in corto

> Decisión del dueño 13-sep: «Aviso al móvil + check-in corto».

## 1. Contexto

- `src/features/bienestar/recordatorio.ts` avisa solo con la app abierta después de las 18:00. Medido: casi nadie lo ve.
- `src/features/avisos/suscripcion.ts` + `PedirPermiso.tsx` ya piden permiso y guardan la suscripción en `public.permisos_de_aviso` (usuario_id, dijo_si, visto_en, endpoint, p256dh, auth, vivo_en, actualizado_en). 3 filas hoy. No hay función que envíe.
- Extensiones en la base: `pg_cron` y `supabase_vault` sí; `pg_net` no.
- `CheckinDiario` (`src/domain/types.ts:487`) viaja a `checkins.datos jsonb` — campos nuevos no piden migración. `src/domain/readiness.ts` promedia `cansancio` (inverso), `estres` (inverso), `motivacion`, `calidadSueno`, `horasSueno`.

## 2. Objetivo

1. Aviso que llega con la app cerrada, 19:00 America/Bogota (00:00 UTC), solo a quien no hizo check-in hoy.
2. Check-in de 3 preguntas obligatorias de un toque; resto plegado opcional.

## 3. Las tres preguntas — campo existente que usa cada una y por qué

### P1 — ¿Cómo dormiste?

- Campo: `calidadSueno: Cualitativo3` (`MALA | REGULAR | BUENA`).
- Por qué reutilizar: es exactamente lo que pregunta. Ya lo lee `readiness.ts` (mapa `CALIDAD`). No se duplica.
- Qué no se hace: no se crea `suenoCalidad2`. `horasSueno` y `horaAcostarse/horaLevantarse` quedan en «más detalles» como dato cuantitativo/cuándo, sin ser obligatorios arriba. Un toque = cualitativo; el número es opcional y no bloquea el guardar.

### P2 — ¿Cómo llegas? (energía)

- Campo: `cansancio: Cantidad3` (`POCO | REGULAR | MUCHO`), leído inverso.
- Por qué reutilizar: el formulario actual ya mide energía por su inverso (poco cansancio = alta energía). `readiness.ts` lo promedia con `CANTIDAD_INVERSA = {POCO:100, REGULAR:55, MUCHO:10}`. Añadir `energia` duplicaría la misma señal con otro nombre y rompería la serie histórica.
- Presentación: etiquetas visibles `Con energía / Normal / Sin energía` mapeadas a `POCO / REGULAR / MUCHO`. El valor guardado sigue siendo `cansancio`.

### P3 — ¿Te duele algo desde ayer? (si sí: dónde y 0-10)

- Campos base: `dolor: number (0..10)` + `dolorDonde?: string`.
- Por qué reutilizar: EVA 0-10 y zona ya existen (`src/domain/senales/dolor.ts`, `TRAMOS_DOLOR`, `UMBRAL_DOLOR_QUE_AVISA=4`). Cambiar escala perdería el umbral clínico.
- Qué se añade: `dolorDesdeAyer?: { hay: boolean; donde?: string; eva?: number }`.
- Por qué añadir: «desde ayer» es temporalidad, no intensidad. `dolor` solo dice cuánto duele hoy; no distingue si es molestia crónica de hace semanas o algo que apareció desde ayer. Sin ese matiz, el coach no puede filtrar «señal nueva».
- Compatibilidad: opcional. Si existe, el formulario lo refleja en `dolor/dolorDonde` (misma EVA y zona) para que `readiness` y vistas viejas lo lean sin cambios. Check-ins viejos sin el campo siguen válidos; `readiness` los promedia igual.

## 4. Lo que NO cambia

- `CheckinDiario.fecha`, `id`, `usuarioId` intactos. `readiness.ts` sin tocar salvo tolerar el campo nuevo.
- Sincronización `src/data/nube/sync.ts` (`bienestar.guardar` → upsert `checkins`) igual: el jsonb lleva lo nuevo sin migración.

## 5. UI — check-in corto

- Arriba, siempre visible: las 3 obligatorias con `CampoPills` / `EscalaDolor` existentes, un toque.
  - Validación corta: `calidadSueno` y `cansancio` requeridos; si `dolorDesdeAyer.hay === true` entonces `dolor` (0-10) y `dlorDonde` no vacío. `dolor=0` con `hay=false` es válido y cuenta como «sin dolor».
- Debajo, plegado `<details>` «Más detalles (opcional)»:
  - `horasSueno`, `horaAcostarse/Levantarse`, `pesoKg` (con lógica `pesoTocado`), `pasos`, `entreno`, `rendimiento`, `motivacion`, `hambreEscala` (1-10), `estres`, `alimentacion`, `comentarios`.
- Sin cambios visuales en pantallas que solo leen (`BienestarPage` resumen, `FilaHistorial`).

## 6. Aviso diario (push con app cerrada)

- Suscripción: ya existe (`suscripcion.ts` con `VITE_VAPID_PUBLIC_KEY`, `PushManager.subscribe` userVisibleOnly + applicationServerKey). No se toca.
- Envío (`supabase/functions/enviar-aviso-checkin/index.ts`, Deno):
  - Lee secretos del entorno: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Nada en código.
  - Selección (separable para test): fecha de hoy en Bogota (`America/Bogota` → `YYYY-MM-DD`), suscripciones donde `dijo_si = true AND endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL AND vivo_en IS NOT NULL` tratado como «viva si nunca se marcó muerta»: `vivo_en IS NULL` se considera viva hasta el primer 404/410; `vivo_en = null` es la marca de muerta. Left join contra `checkins` por `usuario_id` y `fecha = hoyBogota`; solo sin fila hoy.
  - Envío: Web Push con VAPID (ES256). Si el push service responde 404/410 → `update permisos_de_aviso set vivo_en = null, actualizado_en = now()` para esa fila. Otros errores no marcan muerta.
  - Idempotencia: remarcar muerta es idempotente; re-suscribirse repone `endpoint/p256dh/auth` y `vivo_en = now()`.
- `public/sw.js` / service worker: al recibir `push`, `showNotification` con tag `bienestar-diario`; `notificationclick` abre `/bienestar`.
- VAPID sujeto `mailto:` configurable via `VAPID_SUBJECT`.

## 7. Base — migración `NNNN_aviso_diario_checkin.sql`

- Sin tablas nuevas. `permisos_de_aviso` y `checkins` ya sirven.
- `pg_net` (http desde SQL) no está: la migración lo activa (`create extension if not exists pg_net`) con el mismo patrón condicional que `0048_ranking_en_cache.sql` (preguntar `pg_available_extensions`, `execute`).
- `pg_cron` programa `00:00 UTC` diario (`19:00 Bogota`): `cron.schedule('aviso-checkin-diario','0 0 * * *', $$ select net.http_post(...) $$)`. Fuera de transacción, detrás del bloque `do $cron_setup$`.
- La llave de servicio NO se escribe: se lee de `vault` (`supabase_vault`) y se inyecta como header `Authorization: Bearer <service>` en el `net.http_post` a `.../functions/v1/enviar-aviso-checkin`. Sin `vault`, aviso en `raise notice` y sin programar el post (degradación: sin aviso, sin roto).
- Prueba SQL si existe `supabase/test/`: selección no duplica, 404/410 marca muerta, con check-in hoy no se envía.

## 8. Riesgos y decisiones aplazadas

- Hora fija 19:00 Bogota; no configurable por usuario en esta entrega (siguiente iteración si se pide).
- `vivo_en = null` como muerta colisiona con «nunca contactado» (también null): se resuelve tratando null inicial como viva y solo el 404/410 como muerto; alternativa futura: columna `estado` explícita.
- `horasSueno` fuera de lo obligatorio pierde un dato cuantitativo arriba, pero se conserva plegado sin bloquear; `readiness` lo promedia si está, si no ignora.
