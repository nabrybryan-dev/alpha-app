# Diseño — Bloque de preparación y sesiones metabólicas

**Fecha:** 2026-07-17 · **Aprobado por:** Bryan (opción A)

## Objetivo

Nadie entrena en frío. Antes de cada sesión de fuerza la asesorada debe: segregar
líquido sinovial, subir la temperatura y trabajar movilidad específica. La app
debe (1) mostrar esa preparación como desplegable antes de los ejercicios, con
registro de cumplimiento, y (2) permitir sesiones cardio/metabólicas propias
dentro del microciclo.

## Decisiones de producto (respuestas de Bryan)

| Pregunta | Decisión |
|---|---|
| ¿Quién define la preparación? | **Mixto**: plantilla base de la marca + el coach la reemplaza por sesión cuando programa algo específico |
| ¿Qué registra la asesorada? | **Solo ✓ hecho** por cada parte (sin datos adicionales) |
| ¿Dónde vive el cardio? | **Ambos**: calentamiento corto dentro de la preparación Y sesiones metabólicas propias del microciclo |
| ¿Gamificación? | **Sí, XP pequeña** por preparación completa (menor que la sesión de fuerza) |

## Arquitectura (opción A elegida)

La preparación viaja **dentro del JSONB del microciclo** (`microciclos.datos`),
igual que los ejercicios. **Sin cambios de esquema en Supabase**: el
write-through existente (`subirMicrociclo`) ya sincroniza cualquier cambio del
microciclo. La plantilla base vive en código; una sesión sin preparación propia
muestra la plantilla, y al marcarla se materializa en el microciclo (así el
estado ✓ persiste y sube a la nube).

Descartada la opción B (editor de plantillas + tabla nueva) por YAGNI: la
programación real es microciclo a microciclo y el futuro generador (Cerebro)
producirá la preparación junto con la prescripción.

## Modelo de datos (`src/domain/types.ts`)

> **Ajuste de Bryan (2026-07-17):** estiramiento y movilidad son conceptos
> similares — NO son subdivisiones separadas. La preparación tiene dos partes:
> **calentamiento cardiovascular** y **movilidad específica** (incluye
> activación del sistema nervioso). Y la plantilla base se adapta al patrón de
> la sesión: torso → hombro/codo/muñeca; pierna → cadera/rodilla/tobillo;
> full body → misma duración total cubriendo la mayor cantidad de
> articulaciones.

```ts
export type TipoPreparacion = 'calentamiento' | 'movilidad'

export interface ItemMarcable {
  id: string
  titulo: string          // "Bici estática ritmo conversacional"
  indicaciones: string    // prescripción/cues del coach
  duracionMin?: number
  contenidoDemoId?: string // enlaza a la biblioteca de contenidos (video demo)
  hechoEn?: string         // ISO; presente = marcado ✓
}

export interface PartePreparacion extends ItemMarcable {
  tipo: TipoPreparacion
}

export interface Sesion {
  // campos existentes…
  tipo?: 'fuerza' | 'metabolica'      // ausente = 'fuerza' (retrocompatible)
  preparacion?: PartePreparacion[]     // ausente = usar plantilla base
  bloquesCardio?: ItemMarcable[]       // solo sesiones metabólicas: intervalos/bloques
}
```

- **Plantilla base:** `src/data/plantillas/preparacionBase.ts` — función
  `plantillaPreparacion(patron): PartePreparacion[]` con
  `patron: 'torso' | 'pierna' | 'fullbody' | 'general'` (ids estables
  `prep-base-*`). Siempre dos partes: cardio suave 5-8 min a ritmo
  conversacional + movilidad/activación específica de las articulaciones
  protagonistas del patrón (torso: hombro, codo, muñeca; pierna: cadera,
  rodilla, tobillo; full body: cobertura amplia en el mismo tiempo).
- **Detección del patrón:** `patronDeSesion(sesion)` lo infiere del nombre
  (UPPER/TORSO → torso; LEG/PIERNA → pierna; FULL → fullbody; si no,
  general). El coach siempre puede sobrescribir programando `preparacion`
  propia en la sesión.
- **Selector:** `preparacionDe(sesion)` devuelve `sesion.preparacion ?? plantillaPreparacion(patronDeSesion(sesion))`.

## Capa de datos

- `repos.ts` → `microciclos.marcarParte(microcicloId, sesionId, parteId)`:
  marca/desmarca (`hechoEn`) tanto partes de preparación como bloques cardio.
  Si la sesión usaba plantilla, primero la materializa (copia inmutable).
- `mockDb.ts` implementa; `sync.ts` envuelve con `subirMicrociclo` (patrón ya
  existente de `registrarSerie`).

## UI (`src/features/entrenar/`)

1. **`PreparacionSesion.tsx`** (nuevo): desplegable "Antes de entrenar" arriba
   de los ejercicios en `SesionPage`. Agrupa por tipo (Calentamiento /
   Movilidad), cada parte con título, indicaciones, duración,
   enlace a video demo si tiene, y botón ✓ grande (uso en gimnasio). Contador
   "2/4" en la cabecera del desplegable; al completar todo, se colapsa y
   muestra estado logrado.
2. **Sesión metabólica en `SesionPage`**: si `tipo === 'metabolica'`, en vez de
   ejercicios de fuerza se listan los `bloquesCardio` como items marcables
   (mismo componente visual), con su preparación propia arriba y el test
   post-sesión existente al completar.
3. **`MicrocicloPage`**: las sesiones metabólicas se distinguen con una
   etiqueta/estilo propio (ej. chip "CARDIO").
4. **Panel del coach** (`AsesoradoDetallePage`): en pautado vs. realizado, chip
   por sesión: preparación **hecha / parcial / omitida** (verde/ámbar/rojo).

## Gamificación (`src/domain/gamification.ts`)

- Preparación completa de una sesión: **+10 XP** (la sesión de fuerza conserva
  su valor actual, mayor).
- Sesión metabólica completada (todos los bloques + test post): misma XP que
  una sesión de entrenamiento normal.
- Sin insignias nuevas por ahora.

## Cumplimiento (`src/domain/cumplimiento.ts`)

- `estadoPreparacion(sesion): 'hecha' | 'parcial' | 'omitida' | 'sin-programar'`
  para el chip del coach. Sesión con plantilla no materializada y sin marcar =
  'omitida' solo si la sesión de fuerza sí se realizó; si la sesión no se ha
  hecho aún, no se juzga.

## Datos de demostración y semilla

- Seed de Valentina: preparación específica en las sesiones de M22 (la de
  pierna con movilidad de cadera, la de torso con movilidad de hombro; LEG A ya
  registrada queda con preparación marcada) y una sesión nueva
  "METABÓLICO A — running 10 × 1'/1'" en M22.
- Regenerar `0002_semilla.sql` (`npm run semilla`); Bryan la re-pega en
  Supabase (operación segura/repetible).

## Fuera de alcance (etapas futuras)

- Editor visual de plantillas en el panel del coach (opción B).
- Registro de métricas de cardio (minutos, distancia, FC).
- Generación automática de la preparación por el Cerebro.

## Testing

- Dominio: XP de preparación, `estadoPreparacion`, sesión metabólica completa.
- Datos: `marcarParte` (materialización de plantilla, inmutabilidad, toggle).
- UI: humo de `SesionPage` con preparación y con sesión metabólica.
- Verificación visual en preview (asesorada y coach) antes de commitear.
