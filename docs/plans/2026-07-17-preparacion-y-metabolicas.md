# Plan — Bloque de preparación y sesiones metabólicas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desplegable "Antes de entrenar" (calentamiento + movilidad específica por patrón) con ✓ por parte y +10 XP, y sesiones metabólicas propias del microciclo, según `docs/specs/2026-07-17-preparacion-y-metabolicas-diseno.md`.

**Architecture:** Todo viaja en el JSONB del microciclo (sin migración de Supabase). Plantilla base por patrón en `src/data/plantillas/`; al marcar una parte se materializa en la sesión y el write-through existente la sube. `sesionCompleta(sesion)` reemplaza a `sesionRegistrada(ejercicios)` en los 4 puntos de uso para soportar sesiones metabólicas.

**Tech Stack:** React 19 + TS + Tailwind, vitest, mockDb inmutable con localStorage, sync write-through a Supabase.

**Convenciones:** commits `feat|fix|test|docs: ...` en español, minúsculas. Correr comandos desde `app/`.

---

### Task 1: Tipos de dominio

**Files:** Modify: `src/domain/types.ts:60-66`

- [ ] **Step 1:** Insertar ANTES de `export interface Sesion`:

```ts
export type TipoPreparacion = 'calentamiento' | 'movilidad'

export interface ItemMarcable {
  id: string
  titulo: string
  indicaciones: string
  duracionMin?: number
  contenidoDemoId?: string
  hechoEn?: string
}

export interface PartePreparacion extends ItemMarcable {
  tipo: TipoPreparacion
}
```

- [ ] **Step 2:** Extender `Sesion` (campos nuevos, todos opcionales — retrocompatible con datos guardados):

```ts
export interface Sesion {
  id: string
  nombre: string
  orden: number
  tipo?: 'fuerza' | 'metabolica'
  preparacion?: PartePreparacion[]
  bloquesCardio?: ItemMarcable[]
  ejercicios: EjercicioPrescrito[]
  testPost?: TestPostSesion
}
```

- [ ] **Step 3:** `npx tsc -b` → sin errores. Commit: `feat: tipos de preparacion y sesion metabolica`

---

### Task 2: Plantilla base por patrón

**Files:** Create: `src/data/plantillas/preparacionBase.ts` · Test: `src/data/plantillas/preparacionBase.test.ts`

- [ ] **Step 1:** Test que falla:

```ts
import { describe, expect, it } from 'vitest'
import { patronDeSesion, plantillaPreparacion, preparacionDe } from './preparacionBase'
import type { Sesion } from '../../domain/types'

const sesion = (nombre: string, extra: Partial<Sesion> = {}): Sesion =>
  ({ id: 's1', nombre, orden: 1, ejercicios: [], ...extra })

describe('patronDeSesion', () => {
  it('detecta el patrón por el nombre', () => {
    expect(patronDeSesion('UPPER A')).toBe('torso')
    expect(patronDeSesion('LEG B')).toBe('pierna')
    expect(patronDeSesion('FULL C')).toBe('fullbody')
    expect(patronDeSesion('METABÓLICO A')).toBe('general')
  })
})

describe('plantillaPreparacion', () => {
  it('siempre trae cardio + movilidad específica del patrón', () => {
    for (const patron of ['torso', 'pierna', 'fullbody', 'general'] as const) {
      const partes = plantillaPreparacion(patron)
      expect(partes.some((p) => p.tipo === 'calentamiento')).toBe(true)
      expect(partes.some((p) => p.tipo === 'movilidad')).toBe(true)
    }
  })
  it('devuelve copias (no referencias compartidas)', () => {
    const a = plantillaPreparacion('torso')
    const b = plantillaPreparacion('torso')
    expect(a[0]).not.toBe(b[0])
  })
})

describe('preparacionDe', () => {
  it('usa la preparación propia si la sesión la trae', () => {
    const propia = [{ id: 'x', tipo: 'movilidad' as const, titulo: 'Cadera', indicaciones: '90/90' }]
    expect(preparacionDe(sesion('LEG A', { preparacion: propia }))).toBe(propia)
  })
  it('cae a la plantilla del patrón si no', () => {
    const partes = preparacionDe(sesion('LEG A'))
    expect(partes.length).toBeGreaterThan(1)
    expect(partes.every((p) => p.id.startsWith('prep-base-'))).toBe(true)
  })
})
```

- [ ] **Step 2:** `npx vitest run src/data/plantillas` → FAIL (módulo no existe).

- [ ] **Step 3:** Implementación:

```ts
import type { PartePreparacion, Sesion, TipoPreparacion } from '../../domain/types'

export type PatronSesion = 'torso' | 'pierna' | 'fullbody' | 'general'

// El coach siempre puede sobrescribir programando `preparacion` en la sesión.
export function patronDeSesion(nombre: string): PatronSesion {
  const n = nombre.toUpperCase()
  if (/UPPER|TORSO|PUSH|PULL|EMPUJE|TRACCI/.test(n)) return 'torso'
  if (/LEG|PIERNA|LOWER|GL[UÚ]TEO/.test(n)) return 'pierna'
  if (/FULL/.test(n)) return 'fullbody'
  return 'general'
}

const parte = (
  id: string,
  tipo: TipoPreparacion,
  titulo: string,
  indicaciones: string,
  duracionMin?: number,
): PartePreparacion => ({ id, tipo, titulo, indicaciones, duracionMin })

const CARDIO_BASE = parte(
  'prep-base-cardio',
  'calentamiento',
  'Cardio suave 5-8 min',
  'Bici, caminadora inclinada o elíptica a ritmo conversacional: sube la temperatura y lubrica las articulaciones antes de cargar.',
  6,
)

const MOVILIDAD: Record<PatronSesion, PartePreparacion[]> = {
  torso: [
    parte('prep-base-torso-1', 'movilidad', 'Dislocaciones de hombro con banda × 12', 'Agarre ancho, brazos estirados: prepara el hombro y activa el manguito rotador.'),
    parte('prep-base-torso-2', 'movilidad', 'Círculos de codo y muñeca × 10 por lado', 'Amplios y controlados: despierta las articulaciones que van a recibir la carga.'),
    parte('prep-base-torso-3', 'movilidad', 'Band pull-apart × 15', 'Aprieta las escápulas al final de cada repetición: activa espalda alta y sistema nervioso.'),
  ],
  pierna: [
    parte('prep-base-pierna-1', 'movilidad', '90/90 de cadera × 8 por lado', 'Transiciones lentas, tronco erguido: abre la cadera en rotación interna y externa.'),
    parte('prep-base-pierna-2', 'movilidad', 'Dorsiflexión de tobillo contra pared × 10 por lado', 'Rodilla hacia la pared sin levantar el talón: el tobillo manda en la sentadilla.'),
    parte('prep-base-pierna-3', 'movilidad', 'Sentadilla profunda con pausa × 8', 'Baja al máximo rango sin carga y quédate 2 s: cadera, rodilla y tobillo trabajando juntas.'),
  ],
  fullbody: [
    parte('prep-base-full-1', 'movilidad', 'Gato-camello × 10', 'Segmenta la columna vértebra a vértebra: prepara el tronco completo.'),
    parte('prep-base-full-2', 'movilidad', 'El mejor estiramiento del mundo × 6 por lado', 'Zancada + rotación torácica: cadera, tobillo y torso en un solo movimiento.'),
    parte('prep-base-full-3', 'movilidad', 'Dislocaciones de hombro con banda × 10', 'Mismo tiempo total que en sesiones enfocadas, cubriendo la mayor cantidad de articulaciones.'),
  ],
  general: [
    parte('prep-base-gen-1', 'movilidad', 'Gato-camello × 10', 'Movilidad general de columna antes de cualquier esfuerzo.'),
    parte('prep-base-gen-2', 'movilidad', 'Balanceos de pierna y círculos de tobillo × 10', 'Frontales y laterales, controlados: prepara cadera y tobillo.'),
  ],
}

export function plantillaPreparacion(patron: PatronSesion): PartePreparacion[] {
  return [CARDIO_BASE, ...MOVILIDAD[patron]].map((p) => ({ ...p }))
}

export function preparacionDe(sesion: Sesion): PartePreparacion[] {
  return sesion.preparacion ?? plantillaPreparacion(patronDeSesion(sesion.nombre))
}
```

- [ ] **Step 4:** `npx vitest run src/data/plantillas` → PASS.
- [ ] **Step 5:** Commit: `feat: plantilla base de preparacion por patron de sesion`

---

### Task 3: Cumplimiento — sesión completa y estado de preparación

**Files:** Modify: `src/domain/cumplimiento.ts` · Test: `src/domain/cumplimiento.test.ts` (agregar bloques)

- [ ] **Step 1:** Tests que fallan (agregar al final del archivo de test existente):

```ts
import { estadoPreparacion, sesionCompleta } from './cumplimiento'
import type { Sesion } from './types'

const base: Sesion = { id: 's', nombre: 'LEG A', orden: 1, ejercicios: [] }
const bloque = (hecho: boolean) => ({ id: `b${Math.random()}`, titulo: 't', indicaciones: 'i', hechoEn: hecho ? '2026-07-17T10:00:00Z' : undefined })
const parte = (hecho: boolean) => ({ ...bloque(hecho), tipo: 'movilidad' as const })

describe('sesionCompleta', () => {
  it('sesión de fuerza usa los ejercicios (vacía = incompleta)', () => {
    expect(sesionCompleta(base)).toBe(false)
  })
  it('metabólica completa cuando todos los bloques están hechos', () => {
    expect(sesionCompleta({ ...base, tipo: 'metabolica', bloquesCardio: [bloque(true), bloque(true)] })).toBe(true)
    expect(sesionCompleta({ ...base, tipo: 'metabolica', bloquesCardio: [bloque(true), bloque(false)] })).toBe(false)
    expect(sesionCompleta({ ...base, tipo: 'metabolica', bloquesCardio: [] })).toBe(false)
  })
})

describe('estadoPreparacion', () => {
  it('hecha / parcial según las partes marcadas', () => {
    expect(estadoPreparacion({ ...base, preparacion: [parte(true), parte(true)] })).toBe('hecha')
    expect(estadoPreparacion({ ...base, preparacion: [parte(true), parte(false)] })).toBe('parcial')
  })
  it('sin marcar: pendiente si la sesión no se ha hecho, omitida si ya se hizo', () => {
    expect(estadoPreparacion({ ...base, preparacion: [parte(false)] })).toBe('pendiente')
    expect(
      estadoPreparacion({ ...base, preparacion: [parte(false)], tipo: 'metabolica', bloquesCardio: [bloque(true)] }),
    ).toBe('omitida')
  })
})
```

- [ ] **Step 2:** `npx vitest run src/domain/cumplimiento.test.ts` → FAIL.

- [ ] **Step 3:** Implementar en `cumplimiento.ts` (después de `sesionRegistrada`):

```ts
export function sesionCompleta(sesion: Sesion): boolean {
  if (sesion.tipo === 'metabolica') {
    const bloques = sesion.bloquesCardio ?? []
    return bloques.length > 0 && bloques.every((b) => Boolean(b.hechoEn))
  }
  return sesionRegistrada(sesion.ejercicios)
}

export type EstadoPreparacion = 'hecha' | 'parcial' | 'omitida' | 'pendiente'

export function estadoPreparacion(sesion: Sesion): EstadoPreparacion {
  const partes = sesion.preparacion ?? []
  const hechas = partes.filter((p) => p.hechoEn).length
  if (partes.length > 0 && hechas === partes.length) return 'hecha'
  if (hechas > 0) return 'parcial'
  return sesionCompleta(sesion) ? 'omitida' : 'pendiente'
}
```

Importar `Sesion` en la línea 1 del archivo: `import type { EjercicioPrescrito, Microciclo, SerieRegistrada, Sesion } from './types'`.

- [ ] **Step 4:** En `resumenMicrociclo` cambiar `micro.sesiones.filter((s) => sesionRegistrada(s.ejercicios))` por `micro.sesiones.filter(sesionCompleta)`.
- [ ] **Step 5:** `npx vitest run src/domain` → PASS. Commit: `feat: sesion completa y estado de preparacion en cumplimiento`

---

### Task 4: Gamificación — XP por preparación

**Files:** Modify: `src/domain/gamification.ts:30-54` · Test: `src/domain/gamification.test.ts`

- [ ] **Step 1:** Test que falla (agregar):

```ts
it('la preparación completa da 10 xp', () => {
  expect(XP_POR_ACCION.preparacion).toBe(10)
  expect(
    calcularXp({ checkins: 0, sesiones: 0, adherenciasSi: 0, adherenciasParcial: 0, respuestas: 0, preparaciones: 3 }),
  ).toBe(30)
})
```

- [ ] **Step 2:** Correr → FAIL (propiedad no existe).
- [ ] **Step 3:** En `gamification.ts`: agregar `preparaciones: number` a `ConteosXp`, `preparacion: 10` a `XP_POR_ACCION`, y el término `+ c.preparaciones * XP_POR_ACCION.preparacion` en `calcularXp`.
- [ ] **Step 4:** `npx tsc -b` marcará los llamadores sin el campo: en `src/features/logros/useGamificacion.ts` agregar al objeto de `calcularXp`:

```ts
preparaciones: microciclos.flatMap((m) => m.sesiones).filter((s) => estadoPreparacion(s) === 'hecha').length,
```

con `import { estadoPreparacion, resumenMicrociclo, sesionCompleta } from '../../domain/cumplimiento'` y cambiando también `filter((s) => sesionRegistrada(s.ejercicios))` → `filter(sesionCompleta)` (línea 36; quitar el import de `sesionRegistrada`). Arreglar cualquier test existente de `calcularXp` agregando `preparaciones: 0`.

- [ ] **Step 5:** `npx vitest run src/domain && npx tsc -b` → PASS. Commit: `feat: xp por preparacion completa`

---

### Task 5: Repositorio — marcarParte

**Files:** Modify: `src/data/repos.ts:28-32`, `src/data/mockDb.ts` · Test: `src/data/mockDb.test.ts`

- [ ] **Step 1:** Test que falla (agregar):

```ts
it('marcarParte materializa la plantilla y alterna el hecho', () => {
  const db = crearMockDb()
  const m22 = db.microciclos.byUsuario('u-valentina').find((m) => m.numero === 22)!
  const full = m22.sesiones.find((s) => s.nombre === 'FULL C')!
  expect(full.preparacion).toBeUndefined()

  db.microciclos.marcarParte(m22.id, full.id, 'prep-base-cardio')
  const leer = () =>
    db.microciclos.byUsuario('u-valentina').find((m) => m.numero === 22)!.sesiones.find((s) => s.nombre === 'FULL C')!
  expect(leer().preparacion!.find((p) => p.id === 'prep-base-cardio')!.hechoEn).toBeTruthy()

  db.microciclos.marcarParte(m22.id, full.id, 'prep-base-cardio')
  expect(leer().preparacion!.find((p) => p.id === 'prep-base-cardio')!.hechoEn).toBeUndefined()
})
```

- [ ] **Step 2:** Correr → FAIL. En `repos.ts`, agregar a `MicrociclosRepo`:

```ts
marcarParte(microcicloId: string, sesionId: string, parteId: string): void
```

- [ ] **Step 3:** En `mockDb.ts`, dentro de `microciclos` (después de `guardarTestPost`), con `import { patronDeSesion, plantillaPreparacion } from './plantillas/preparacionBase'` y `ItemMarcable` en los tipos importados:

```ts
marcarParte: (microcicloId: string, sesionId: string, parteId: string) => {
  const alternar = <T extends ItemMarcable>(item: T): T =>
    item.id === parteId
      ? { ...item, hechoEn: item.hechoEn ? undefined : new Date().toISOString() }
      : item
  mutar(
    actualizarMicrociclo(ref.actual, microcicloId, (m) => ({
      ...m,
      sesiones: m.sesiones.map((s) => {
        if (s.id !== sesionId) return s
        const preparacion = s.preparacion ?? plantillaPreparacion(patronDeSesion(s.nombre))
        return { ...s, preparacion: preparacion.map(alternar), bloquesCardio: s.bloquesCardio?.map(alternar) }
      }),
    })),
  )
},
```

- [ ] **Step 4:** `npx vitest run src/data` → PASS.
- [ ] **Step 5:** Write-through en `src/data/nube/sync.ts`, dentro de `microciclos` junto a `registrarSerie`:

```ts
marcarParte: (microcicloId, sesionId, parteId) => {
  local.microciclos.marcarParte(microcicloId, sesionId, parteId)
  subirMicrociclo(local, microcicloId)
},
```

- [ ] **Step 6:** `npx tsc -b && npx vitest run` → todo PASS. Commit: `feat: marcar partes de preparacion con sincronizacion a la nube`

---

### Task 6: Seed — preparación programada y sesión metabólica de Valentina

**Files:** Modify: `src/data/seed/valentina.ts`

- [ ] **Step 1:** Importar tipos: agregar `ItemMarcable, PartePreparacion` al import de tipos y `fechaIsoAtras` al import de `./fechas`. Agregar helpers después de `seriesDe`:

```ts
const prep = (
  id: string,
  tipo: PartePreparacion['tipo'],
  titulo: string,
  indicaciones: string,
): PartePreparacion => ({ id, tipo, titulo, indicaciones })

function prepPierna(sufijo: string, letra: string): PartePreparacion[] {
  return [
    prep(`prep-${sufijo}-${letra}-cardio`, 'calentamiento', 'Bici 6 min ritmo conversacional', 'Cadencia alta sin resistencia: temperatura y líquido sinovial antes de cargar.'),
    prep(`prep-${sufijo}-${letra}-9090`, 'movilidad', '90/90 de cadera × 8 por lado', 'Transiciones lentas; hoy la cadera es protagonista.'),
    prep(`prep-${sufijo}-${letra}-tobillo`, 'movilidad', 'Dorsiflexión de tobillo × 10 por lado', 'Rodilla a la pared sin levantar talón.'),
  ]
}

function prepTorso(sufijo: string, letra: string): PartePreparacion[] {
  return [
    prep(`prep-${sufijo}-${letra}-cardio`, 'calentamiento', 'Remo o elíptica 6 min suave', 'Ritmo conversacional; involucra brazos para irrigar el tren superior.'),
    prep(`prep-${sufijo}-${letra}-banda`, 'movilidad', 'Dislocaciones con banda × 12', 'Agarre ancho; hombro, codo y muñeca listos para empujar y traccionar.'),
    prep(`prep-${sufijo}-${letra}-pullapart`, 'movilidad', 'Band pull-apart × 15', 'Aprieta escápulas 1 s: activación de espalda alta y sistema nervioso.'),
  ]
}
```

- [ ] **Step 2:** En `sesionesBloque`, agregar a cada sesión su preparación (FULL C se queda SIN `preparacion` a propósito — demuestra la plantilla automática):
  - LEG A: `preparacion: prepPierna(sufijo, 'la'),`
  - UPPER A: `preparacion: prepTorso(sufijo, 'ua'),`
  - LEG B: `preparacion: prepPierna(sufijo, 'lb'),`
  - UPPER B: `preparacion: prepTorso(sufijo, 'ub'),`

  Y al inicio de `sesionesBloque`, marcar todo como hecho cuando `conRegistro` (M21 cerrado): envolver cada llamada con:

```ts
const conMarca = (partes: PartePreparacion[]): PartePreparacion[] =>
  conRegistro ? partes.map((p) => ({ ...p, hechoEn: fechaIsoAtras(10, '17:02:00') })) : partes
```

  y usar `preparacion: conMarca(prepPierna(sufijo, 'la'))`, etc.

- [ ] **Step 3:** En `conLegARegistrada`, además del `testPost` y las series, marcar la preparación:

```ts
preparacion: s.preparacion?.map((p) => ({ ...p, hechoEn: fechaIsoAtras(2, '17:02:00') })),
```

- [ ] **Step 4:** Sesión metabólica nueva (después de `conLegARegistrada`):

```ts
function sesionMetabolica(sufijo: string): Sesion {
  const bloque = (id: string, titulo: string, indicaciones: string, duracionMin: number): ItemMarcable =>
    ({ id, titulo, indicaciones, duracionMin })
  return {
    id: `s-metab-${sufijo}`,
    nombre: 'METABÓLICO A',
    orden: 6,
    tipo: 'metabolica',
    ejercicios: [],
    preparacion: [
      prep(`prep-${sufijo}-met-tobillo`, 'movilidad', 'Tobillos y balanceos de pierna × 10', 'Círculos de tobillo y balanceos frontales antes de correr.'),
    ],
    bloquesCardio: [
      bloque(`bc-${sufijo}-1`, 'Calentamiento: 5 min trote suave', 'Ritmo conversacional, zancada corta.', 5),
      bloque(`bc-${sufijo}-2`, '10 × 1 min fuerte / 1 min suave', 'El minuto fuerte a RPE 8: palabras sueltas, no frases. El suave es trote, no caminata.', 20),
      bloque(`bc-${sufijo}-3`, 'Enfriamiento: 5 min caminata', 'Baja pulsaciones caminando, respira por la nariz.', 5),
    ],
  }
}
```

- [ ] **Step 5:** En `microciclosValentina`, el M22 pasa a:

```ts
sesiones: [...conLegARegistrada(sesionesBloque('m22', false)), sesionMetabolica('m22')],
```

- [ ] **Step 6:** `npx tsc -b && npx vitest run` → PASS (si algún test asume 5 sesiones en M22, ajustarlo al nuevo total de 6). Commit: `feat: seed con preparacion programada y sesion metabolica en m22`

---

### Task 7: UI — desplegable "Antes de entrenar" y sesión metabólica

**Files:** Create: `src/features/entrenar/PreparacionSesion.tsx` · Modify: `src/features/entrenar/SesionPage.tsx`

- [ ] **Step 1:** Componente nuevo:

```tsx
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { Contenido, PartePreparacion, TipoPreparacion } from '../../domain/types'

const GRUPOS: { tipo: TipoPreparacion; titulo: string }[] = [
  { tipo: 'calentamiento', titulo: 'Calentamiento' },
  { tipo: 'movilidad', titulo: 'Movilidad y activación' },
]

interface Props {
  partes: PartePreparacion[]
  onMarcar: (parteId: string) => void
  onVerDemo: (contenido: Contenido) => void
}

export function PreparacionSesion({ partes, onMarcar, onVerDemo }: Props) {
  const hechas = partes.filter((p) => p.hechoEn).length
  const completa = partes.length > 0 && hechas === partes.length
  const [abierta, setAbierta] = useState(!completa)

  if (partes.length === 0) return null

  return (
    <Card className={completa ? 'opacity-75' : ''}>
      <button type="button" onClick={() => setAbierta(!abierta)} className="flex w-full items-center justify-between gap-2 text-left">
        <div>
          <p className="kicker">Antes de entrenar</p>
          <p className="mt-0.5 text-xs text-tenue">Sube temperatura, lubrica articulaciones, activa. Nadie entrena en frío.</p>
        </div>
        <span className="flex items-center gap-2">
          {completa ? <Badge tono="verde">✓ +{XP_POR_ACCION.preparacion} XP</Badge> : <Badge>{hechas}/{partes.length}</Badge>}
          <span aria-hidden="true" className="text-tenue">{abierta ? '▲' : '▼'}</span>
        </span>
      </button>

      {abierta && (
        <div className="mt-3 flex flex-col gap-3">
          {GRUPOS.map(({ tipo, titulo }) => {
            const grupo = partes.filter((p) => p.tipo === tipo)
            if (grupo.length === 0) return null
            return (
              <div key={tipo}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-tenue">{titulo}</p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {grupo.map((parte) => {
                    const demo = parte.contenidoDemoId ? db.contenidos.byId(parte.contenidoDemoId) : undefined
                    return (
                      <li key={parte.id} className="flex items-start gap-2.5">
                        <button
                          type="button"
                          aria-label={parte.hechoEn ? `Desmarcar ${parte.titulo}` : `Marcar ${parte.titulo}`}
                          onClick={() => onMarcar(parte.id)}
                          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-sm font-bold ${
                            parte.hechoEn ? 'border-verde bg-verde text-white' : 'border-linea text-tenue'
                          }`}
                        >
                          ✓
                        </button>
                        <div className={parte.hechoEn ? 'opacity-60' : ''}>
                          <p className="text-sm font-bold text-texto">
                            {parte.titulo}
                            {parte.duracionMin ? <span className="ml-1 text-xs font-normal text-tenue">· {parte.duracionMin} min</span> : null}
                          </p>
                          <p className="text-xs text-tenue">{parte.indicaciones}</p>
                          {demo && (
                            <button type="button" onClick={() => onVerDemo(demo)} className="mt-0.5 text-xs font-bold text-azul">
                              🎬 Ver técnica
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 2:** En `SesionPage.tsx`:
  - Imports: `import { PreparacionSesion } from './PreparacionSesion'`, `import { preparacionDe } from '../../data/plantillas/preparacionBase'`, y cambiar `sesionRegistrada` por `sesionCompleta` en el import de cumplimiento.
  - Línea 32: `const todasRegistradas = sesionCompleta(sesion)`.
  - Reemplazar el `<p>` estático "Movilidad y activación previa: 8 min…" (líneas 58-60) por nada (la tarjeta nueva lo cubre).
  - Insertar después del `<section>` de cabecera:

```tsx
<PreparacionSesion
  partes={preparacionDe(sesion)}
  onMarcar={(parteId) => db.microciclos.marcarParte(microciclo.id, sesion.id, parteId)}
  onVerDemo={setDemo}
/>
```

  - Sesión metabólica: envolver el `sesion.ejercicios.map(...)` existente en `{sesion.tipo !== 'metabolica' && sesion.ejercicios.map(...)}` y agregar debajo:

```tsx
{sesion.tipo === 'metabolica' && (
  <Card>
    <p className="kicker">Bloques de la sesión</p>
    <ul className="mt-2 flex flex-col gap-2">
      {(sesion.bloquesCardio ?? []).map((bloque) => (
        <li key={bloque.id} className="flex items-start gap-2.5">
          <button
            type="button"
            aria-label={bloque.hechoEn ? `Desmarcar ${bloque.titulo}` : `Marcar ${bloque.titulo}`}
            onClick={() => db.microciclos.marcarParte(microciclo.id, sesion.id, bloque.id)}
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-sm font-bold ${
              bloque.hechoEn ? 'border-verde bg-verde text-white' : 'border-linea text-tenue'
            }`}
          >
            ✓
          </button>
          <div className={bloque.hechoEn ? 'opacity-60' : ''}>
            <p className="text-sm font-bold text-texto">
              {bloque.titulo}
              {bloque.duracionMin ? <span className="ml-1 text-xs font-normal text-tenue">· {bloque.duracionMin} min</span> : null}
            </p>
            <p className="text-xs text-tenue">{bloque.indicaciones}</p>
          </div>
        </li>
      ))}
    </ul>
  </Card>
)}
```

- [ ] **Step 3:** `npx tsc -b && npx vitest run` → PASS. Verificar en preview (ver Task 10). Commit: `feat: desplegable antes de entrenar y sesion metabolica en la pantalla de sesion`

---

### Task 8: UI — microciclo y hoy

**Files:** Modify: `src/features/entrenar/MicrocicloPage.tsx`, `src/features/hoy/HoyPage.tsx`

- [ ] **Step 1:** `MicrocicloPage.tsx`: cambiar import a `sesionCompleta` (línea 7) y `const registrada = sesionCompleta(sesion)` (línea 44). El subtítulo (línea 50):

```tsx
<p className="text-xs text-tenue">
  {sesion.tipo === 'metabolica'
    ? `${(sesion.bloquesCardio ?? []).length} bloques · cardio`
    : `${sesion.ejercicios.length} ejercicios`}
</p>
```

  Y junto al nombre (línea 49):

```tsx
<h3 className="font-display text-lg text-texto">
  {sesion.nombre}
  {sesion.tipo === 'metabolica' && (
    <span className="ml-2 rounded-full bg-azul/15 px-2 py-0.5 align-middle text-[10px] font-bold text-azul">CARDIO</span>
  )}
</h3>
```

- [ ] **Step 2:** `HoyPage.tsx` línea 16: `const siguienteSesion = microciclo?.sesiones.find((s) => !sesionCompleta(s))` (ajustar import; quitar `sesionRegistrada` si queda sin uso).
- [ ] **Step 3:** `npx tsc -b && npx vitest run` → PASS. Commit: `feat: microciclo y hoy distinguen sesiones metabolicas`

---

### Task 9: Panel del coach — chip de preparación

**Files:** Modify: `src/features/coach/PautadoVsRealizado.tsx`

- [ ] **Step 1:** Imports: `import { desviacionRir, ejercicioCompleto, estadoPreparacion, type EstadoPreparacion } from '../../domain/cumplimiento'`. Encima del componente:

```ts
const CHIP_PREP: Record<EstadoPreparacion, { tono: 'verde' | 'ambar' | 'rojo' | 'neutro'; texto: string }> = {
  hecha: { tono: 'verde', texto: 'Preparación ✓' },
  parcial: { tono: 'ambar', texto: 'Preparación parcial' },
  omitida: { tono: 'rojo', texto: 'Preparación omitida' },
  pendiente: { tono: 'neutro', texto: 'Preparación pendiente' },
}
```

- [ ] **Step 2:** En la cabecera de cada sesión (junto al `<h4>`), agregar:

```tsx
<Badge tono={CHIP_PREP[estadoPreparacion(sesion)].tono}>{CHIP_PREP[estadoPreparacion(sesion)].texto}</Badge>
```

- [ ] **Step 3:** Para sesiones metabólicas, la tabla de ejercicios queda vacía; agregar después de la tabla (dentro del mismo `Card`):

```tsx
{sesion.tipo === 'metabolica' && (
  <ul className="mt-1 flex flex-col gap-1 text-xs">
    {(sesion.bloquesCardio ?? []).map((b) => (
      <li key={b.id} className="flex items-center gap-2">
        <span className={b.hechoEn ? 'text-verde' : 'text-tenue'}>{b.hechoEn ? '✓' : '○'}</span>
        <span className="text-texto/90">{b.titulo}</span>
      </li>
    ))}
  </ul>
)}
```

  (y ocultar la tabla si no hay ejercicios: envolver `<div className="mt-2 overflow-x-auto">` con `{sesion.ejercicios.length > 0 && (...)}`).

- [ ] **Step 4:** `npx tsc -b && npx vitest run` → PASS. Commit: `feat: chip de preparacion y bloques cardio en pautado vs realizado`

---

### Task 10: Verificación integral y semilla

- [ ] **Step 1:** `npx vitest run && npm run build` → todo verde.
- [ ] **Step 2:** Verificar en el preview del navegador (modo demo o nube):
  - Asesorada → Entrenar → UPPER A: desplegable con calentamiento/movilidad, marcar partes, contador y +10 XP al completar.
  - FULL C: muestra la plantilla automática (patrón fullbody).
  - METABÓLICO A: chip CARDIO en el microciclo, bloques marcables, test post al completar.
  - Coach → Valentina → Entrenamiento: chips de preparación (LEG A ✓ verde, resto pendiente) y bloques del metabólico.
- [ ] **Step 3:** `npm run semilla` (regenera `0002_semilla.sql` + `.local.sql` con los datos nuevos). Avisar a Bryan que re-pegue el `.local.sql` en Supabase.
- [ ] **Step 4:** Actualizar `docs/specs/2026-07-17-preparacion-y-metabolicas-diseno.md` si algo divergió. Commit final: `feat: bloque de preparacion y sesiones metabolicas completos`

---

## Autorrevisión del plan

- **Cobertura del spec:** tipos (T1), plantilla por patrón + unificación movilidad/estiramiento (T2), sesionCompleta/estadoPreparacion (T3), XP (T4), marcarParte + sync (T5), seed + metabólica (T6), UI asesorada (T7-T8), chip coach (T9), semilla (T10). ✓
- **Nota de diseño:** el estado `sin-programar` del spec se implementa como `pendiente` (más preciso: la plantilla siempre existe).
- **Consistencia de nombres:** `marcarParte`, `sesionCompleta`, `estadoPreparacion`, `preparacionDe`, `plantillaPreparacion`, `patronDeSesion` usados idénticos en todas las tareas. ✓
