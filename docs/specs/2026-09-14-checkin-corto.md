# 2026-09-14 — Check-in corto (3 preguntas)

> Decisión del dueño 13-sep: check-in corto. Extraído de `2026-09-13-aviso-diario-y-checkin-corto.md` dejando solo la parte del check-in.

## 1. Contexto

- `CheckinDiario` (`src/domain/types.ts:487`) viaja a `checkins.datos jsonb` — campos nuevos no piden migración. `src/domain/readiness.ts` promedia `cansancio` (inverso), `estres` (inverso), `motivacion`, `calidadSueno`, `horasSueno`.

## 2. Objetivo

Check-in de 3 preguntas obligatorias de un toque; resto plegado opcional.

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
  - Validación corta: `calidadSueno` y `cansancio` requeridos; si `dolorDesdeAyer.hay === true` entonces `dolor` (0-10) y `dolorDonde` no vacío cuando `dolor > 0`. `dolor=0` con `hay=false` es válido y cuenta como «sin dolor».
- Debajo, plegado `<details>` «Más detalles (opcional)»:
  - `horasSueno`, `horaAcostarse/Levantarse`, `pesoKg` (con lógica `pesoTocado`), `pasos`, `entreno`, `rendimiento`, `motivacion`, `hambreEscala` (1-10), `estres`, `alimentacion`, `comentarios`.
- Sin cambios visuales en pantallas que solo leen (`BienestarPage` resumen, `FilaHistorial`).
