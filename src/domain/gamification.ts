export interface Racha {
  actual: number
  record: number
}

const DIA_MS = 24 * 60 * 60 * 1000

function aDia(fecha: string): number {
  return Math.floor(new Date(`${fecha}T00:00:00`).getTime() / DIA_MS)
}

export function calcularRacha(fechas: string[], hoy: string): Racha {
  if (fechas.length === 0) return { actual: 0, record: 0 }
  const dias = [...new Set(fechas.map(aDia))].sort((a, b) => a - b)

  let record = 1
  let corrida = 1
  for (let i = 1; i < dias.length; i++) {
    corrida = dias[i] - dias[i - 1] === 1 ? corrida + 1 : 1
    record = Math.max(record, corrida)
  }

  const diaHoy = aDia(hoy)
  const ultimo = dias[dias.length - 1]
  const actual = diaHoy - ultimo <= 1 ? corrida : 0

  return { actual, record }
}

/**
 * Cuánto de la racha se ha recorrido contra el propio récord, entre 0 y 1.
 *
 * Lo consume la tira de rachas de Logros para decidir cuánta pieza descubre cada
 * celda, pero la regla es de dominio y no de pintura: es «hasta dónde has
 * llegado contra tu máximo», y se lee igual en una barra que en una calle.
 *
 * **La guarda de `record <= 0` no es defensiva, es el caso real** de quien no ha
 * registrado nada nunca: `calcularRacha([])` devuelve `{0, 0}`. Sin ella el
 * cociente es `NaN`, que en CSS no da error — se ignora la anchura y la celda
 * aparece entera, o sea justo lo contrario de lo que hay que enseñar.
 *
 * Se acota a 1 aunque hoy `actual` no pueda superar a `record`: si esa relación
 * cambia algún día, aquí no puede salir una anchura negativa.
 */
export function fraccionDeRacha({ actual, record }: Racha): number {
  if (record <= 0) return 0
  return Math.min(1, Math.max(0, actual / record))
}

export interface ConteosXp {
  checkins: number
  sesiones: number
  adherenciasSi: number
  adherenciasParcial: number
  respuestas: number
  preparaciones: number
}

export const XP_POR_ACCION = {
  checkin: 10,
  sesion: 20,
  adherenciaSi: 10,
  adherenciaParcial: 5,
  respuesta: 15,
  preparacion: 10,
} as const

export function calcularXp(c: ConteosXp): number {
  return (
    c.checkins * XP_POR_ACCION.checkin +
    c.sesiones * XP_POR_ACCION.sesion +
    c.adherenciasSi * XP_POR_ACCION.adherenciaSi +
    c.adherenciasParcial * XP_POR_ACCION.adherenciaParcial +
    c.respuestas * XP_POR_ACCION.respuesta +
    c.preparaciones * XP_POR_ACCION.preparacion
  )
}

export interface Nivel {
  nombre: string
  xpMinimo: number
}

export const NIVELES: Nivel[] = [
  { nombre: 'Iniciado', xpMinimo: 0 },
  { nombre: 'Constante', xpMinimo: 150 },
  { nombre: 'Disciplinado', xpMinimo: 400 },
  { nombre: 'Espartano', xpMinimo: 800 },
  { nombre: 'Heracles', xpMinimo: 1500 },
]

export function nivelDeXp(xp: number): Nivel {
  return [...NIVELES].reverse().find((n) => xp >= n.xpMinimo) ?? NIVELES[0]
}

export function siguienteNivel(xp: number): Nivel | undefined {
  return NIVELES.find((n) => n.xpMinimo > xp)
}

export interface DatosLogros {
  sesionesRegistradas: number
  diasCheckinConsecutivos: number
  microcicloCompleto: boolean
  adherenciaPerfectaMicrociclo: boolean
  cuestionariosPendientes: number
  semanasConstancia: number
}

export interface Logro {
  id: string
  titulo: string
  criterio: string
  desbloqueado: boolean
}

export function evaluarLogros(d: DatosLogros): Logro[] {
  return [
    {
      id: 'primera-sesion',
      titulo: 'Primera sesión registrada',
      criterio: 'Registra tu primera sesión de entrenamiento completa',
      desbloqueado: d.sesionesRegistradas >= 1,
    },
    {
      id: 'semana-bienestar',
      titulo: 'Semana de bienestar completa',
      criterio: 'Llena tu check-in diario 7 días seguidos',
      desbloqueado: d.diasCheckinConsecutivos >= 7,
    },
    {
      id: 'microciclo-100',
      titulo: 'Microciclo 100% registrado',
      criterio: 'Registra todas las sesiones de un microciclo',
      desbloqueado: d.microcicloCompleto,
    },
    {
      id: 'constancia-4-semanas',
      titulo: '4 semanas de constancia',
      criterio: 'Mantén una racha de registro de 4 semanas',
      desbloqueado: d.semanasConstancia >= 4,
    },
    {
      id: 'adherencia-perfecta',
      titulo: 'Nutrición impecable',
      criterio: 'Adherencia nutricional perfecta durante un microciclo',
      desbloqueado: d.adherenciaPerfectaMicrociclo,
    },
    {
      id: 'cuestionarios-al-dia',
      titulo: 'Cuestionarios al día',
      criterio: 'Responde todos los cuestionarios asignados',
      desbloqueado: d.cuestionariosPendientes === 0,
    },
  ]
}
