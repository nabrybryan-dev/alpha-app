/**
 * La tarjeta del check-in que arma Praxis desde lo que la persona contó (paso 2 del diseño
 * docs/specs/2026-11-07-conectores-lenguaje-a-checkin-diseno.md). PURO: sin red, sin base, sin estado de módulo.
 *
 * Reglas:
 *  - Nada se guarda sin que la persona toque su opción: una fila sin elección explícita queda pendiente, aunque
 *    Praxis haya marcado un valor. «No anotar» la deja fuera.
 *  - Las opciones son las del formulario (`CheckinForm.tsx`), con los mismos rótulos. Un valor fuera de la escala no entra.
 *  - El dolor solo admite el cero por aquí (como `vida.ts`); cualquier otro valor lo marca la persona en el formulario.
 *  - Lo que falta de los 8 obligatorios se pregunta DE A UNO, y la respuesta siguiente se lee con esa pregunta como
 *    `preguntaAnterior` del conector: así «ahí, como medio» sabe de qué habla.
 *  - Un check-in con alguno de los 8 vacío queda `parcial` (decisión de Bryan, 7-nov: no da puntos hasta completarlo).
 *
 * Detrás de `CONECTORES_EN_TARJETA` (apagada): nada de la app lo llama todavía.
 */
import type { PreguntaDeTramo, ResultadoConectores } from './conectores.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

/** Apagada hasta que exista el guardado por el libro (paso 4) y Bryan diga que sí. */
export const CONECTORES_EN_TARJETA = false

/** Los 8 que el formulario exige, en su orden (`CheckinForm.tsx:136`, orden de pantalla 222-262). */
export const OBLIGATORIOS: readonly CampoCheckin[] = [
  'rendimiento', 'motivacion', 'hambreEscala', 'cansancio', 'estres', 'dolor', 'calidadSueno', 'alimentacion',
]

const CUALITATIVOS = ['MALA', 'REGULAR', 'BUENA'] as const
const CANTIDADES = ['POCO', 'REGULAR', 'MUCHO'] as const

/** Rótulo y opciones de cada pregunta, tal como los enseña el formulario. */
const PREGUNTA: Record<CampoCheckin, { rotulo: string; opciones: readonly (string | number)[] }> = {
  rendimiento: { rotulo: '¿Cómo estuvo tu rendimiento?', opciones: CUALITATIVOS },
  motivacion: { rotulo: 'Motivación', opciones: CANTIDADES },
  hambreEscala: { rotulo: 'Hambre de hoy', opciones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  cansancio: { rotulo: 'Cansancio', opciones: CANTIDADES },
  estres: { rotulo: 'Estrés', opciones: CANTIDADES },
  dolor: { rotulo: 'Dolor de hoy', opciones: [0] },
  horasSueno: { rotulo: 'Horas de sueño', opciones: [] },
  calidadSueno: { rotulo: 'Calidad del sueño', opciones: CUALITATIVOS },
  alimentacion: { rotulo: '¿Cómo estuvo tu alimentación?', opciones: CUALITATIVOS },
}

export interface FilaTarjeta {
  campo: CampoCheckin
  rotulo: string
  opciones: readonly (string | number)[]
  /** Lo que Praxis propone marcado; `null` si la persona debe elegir entre varios. */
  marcado: string | number | null
  /** Entre cuáles elegir cuando la frase cae entre dos niveles. */
  candidatos: (string | number)[]
  cita: string
  origen: 'tabla' | 'vago' | 'dudosa'
}

export interface TarjetaCheckin { filas: FilaTarjeta[]; tramos: PreguntaDeTramo[]; faltantes: CampoCheckin[] }

/** Arma la tarjeta. `null` si el mensaje fue a la ruta de riesgo: ahí no hay tarjeta. `yaHoy` = campos ya llenos hoy. */
export function armarTarjeta(r: ResultadoConectores, yaHoy: readonly CampoCheckin[] = []): TarjetaCheckin | null {
  if (r.tipo === 'riesgo') return null
  const filas: FilaTarjeta[] = [
    ...r.propuestas.map((p): FilaTarjeta => ({
      campo: p.campo, rotulo: PREGUNTA[p.campo].rotulo, opciones: PREGUNTA[p.campo].opciones,
      marcado: p.valor, candidatos: [], cita: p.cita, origen: p.origen,
    })),
    ...r.dudosas.map((d): FilaTarjeta => ({
      campo: d.campo, rotulo: PREGUNTA[d.campo].rotulo, opciones: PREGUNTA[d.campo].opciones,
      marcado: null, candidatos: [...new Set(d.candidatos.map((c) => c.valor))], cita: d.candidatos[0]?.cita ?? '', origen: 'dudosa',
    })),
    // El hambre vaga no da número: llega como fila con los 10 números del formulario, sin nada marcado.
    ...r.preguntas.slice(0, 1).map((p): FilaTarjeta => ({
      campo: p.campo, rotulo: PREGUNTA.hambreEscala.rotulo, opciones: PREGUNTA.hambreEscala.opciones,
      marcado: null, candidatos: [], cita: p.cita, origen: 'dudosa',
    })),
  ]
  const cubiertos = new Set<CampoCheckin>([...filas.map((f) => f.campo), ...yaHoy])
  return { filas, tramos: r.preguntas, faltantes: OBLIGATORIOS.filter((c) => !cubiertos.has(c)) }
}

export type Eleccion = { campo: CampoCheckin; valor: string | number } | { campo: CampoCheckin; noAnotar: true }

export interface Confirmado {
  /** Solo lo que la persona tocó. Va al guardado (paso 4); hoy nadie lo guarda. */
  parche: Partial<Record<CampoCheckin, string | number>>
  /** Los números del formulario que Praxis anotó (para `CheckinDiario.anotadoHoy`). */
  anotadoHoy: 'horasSueno'[]
  /** Filas que quedaron sin elegir: no se guardan. */
  pendientes: CampoCheckin[]
  errores: { campo: CampoCheckin; motivo: string }[]
  /** Falta alguno de los 8: no da puntos hasta completarlo (Bryan, 7-nov). */
  parcial: boolean
}

function valorValido(campo: CampoCheckin, v: string | number): string | null {
  if (campo === 'horasSueno') return typeof v === 'number' && v >= 0 && v <= 14 && Number.isInteger(v * 2) ? null : 'las horas van de 0 a 14, de media en media'
  if (campo === 'dolor' && v !== 0) return 'el dolor lo marca la persona en el formulario; por aquí solo «sin dolor»'
  return PREGUNTA[campo].opciones.includes(v) ? null : 'ese valor no es una opción de esta pregunta'
}

/** Lo que la persona confirmó en la tarjeta. Una elección repetida para el mismo campo: manda la última. */
export function confirmarTarjeta(t: TarjetaCheckin, elecciones: readonly Eleccion[], yaHoy: readonly CampoCheckin[] = []): Confirmado {
  const ultima = new Map<CampoCheckin, Eleccion>()
  for (const e of elecciones) ultima.set(e.campo, e)
  const parche: Confirmado['parche'] = {}
  const errores: Confirmado['errores'] = []
  for (const [campo, e] of ultima) {
    if ('noAnotar' in e) continue
    const error = valorValido(campo, e.valor)
    if (error) errores.push({ campo, motivo: error })
    else parche[campo] = e.valor
  }
  const pendientes = t.filas.map((f) => f.campo).filter((c) => !ultima.has(c))
  const llenos = new Set<CampoCheckin>([...(Object.keys(parche) as CampoCheckin[]), ...yaHoy])
  return {
    parche, anotadoHoy: parche.horasSueno !== undefined ? ['horasSueno'] : [], pendientes, errores,
    parcial: OBLIGATORIOS.some((c) => !llenos.has(c)),
  }
}

/** Dos formas abiertas por pregunta; se alternan por turno para no repetir la misma frase. */
const FORMAS: Partial<Record<CampoCheckin, readonly [string, string]>> = {
  rendimiento: ['¿Cómo te fue hoy en el entreno?', '¿Y el entreno, cómo lo sentiste?'],
  motivacion: ['¿Cómo andas de ganas de entrenar?', '¿Y las ganas de entrenar hoy?'],
  hambreEscala: ['¿Cómo ha estado el hambre hoy?', '¿Y el hambre, cómo la has llevado?'],
  cansancio: ['¿Cómo está la energía?', '¿Y de cansancio, cómo vas?'],
  estres: ['¿Cómo vas de estrés hoy?', '¿Y el estrés, cómo está?'],
  dolor: ['¿Te duele algo hoy?', '¿Y el cuerpo, alguna molestia?'],
  calidadSueno: ['¿Cómo dormiste?', '¿Y el sueño de anoche?'],
  alimentacion: ['¿Cómo te fue con la comida?', '¿Y la alimentación hoy?'],
}

/**
 * La siguiente pregunta: UNA, la primera que falta, abierta. Devuelve el campo para pasarlo como `preguntaAnterior`
 * al leer la respuesta. `null` si ya no falta nada.
 */
export function siguientePregunta(faltantes: readonly CampoCheckin[], turno: number): { campo: CampoCheckin; texto: string } | null {
  const campo = faltantes[0]
  if (!campo) return null
  const formas = FORMAS[campo]
  return { campo, texto: formas ? formas[Math.abs(turno) % 2] : PREGUNTA[campo].rotulo }
}
