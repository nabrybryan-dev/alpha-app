import type { MedidaCorporal, Perfil } from './types'

/**
 * Requisito de datos corporales para poder ver el plan de entrenamiento.
 *
 * Por qué existe: en agosto de 2026, ocho asesorados no tenían **ni una** medida
 * corporal y la mayoría del resto las tenía de febrero a abril. Dos de ellos
 * entrenaban un bloque entero dedicado a la masa de glúteo sin que nadie midiera
 * el glúteo. Un bloque de ocho semanas construido sobre algo que no se mide no se
 * puede evaluar cuando termina.
 *
 * La puerta se pone en el plan de entrenamiento, **no en la app entera**: el
 * formulario de medidas y el bienestar quedan siempre accesibles. Bloquear la
 * pantalla que levanta el bloqueo sería un candado sin llave.
 */

/** Perímetros que se exigen a todo el mundo. */
export const PERIMETROS_BASE = ['Cintura'] as const

/** Una medida más vieja que esto ya no describe dónde está la persona. */
export const DIAS_VIGENCIA = 60

const MS_POR_DIA = 86_400_000

export interface RequisitoMedidas {
  /** `false` solo cuando hay certeza de que faltan datos. */
  cumple: boolean
  /** Etiquetas legibles de lo que hay que cargar. */
  faltan: string[]
  /** Hay medidas, pero la más reciente ya no está vigente. */
  vencida: boolean
  /** Días desde la medida más reciente. `undefined` si no hay ninguna. */
  diasDesdeUltima?: number
  /** El perfil aún no ha llegado: no se bloquea por no saber. */
  indeterminado?: boolean
}

/** Quita tildes y mayúsculas para comparar «Glúteo» con «GLUTEO». */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Nombres distintos para la misma medida. En la base conviven `Muslo D`,
 * `Muslo derecho` y `Pierna derecha` para lo mismo, según quién cargara la ficha.
 */
const SINONIMOS: Record<string, readonly string[]> = {
  muslo: ['pierna'],
  gluteo: ['gluteos'],
}

/**
 * ¿La medida `clave` sirve para cubrir el requisito `exigido`?
 *
 * Se compara por FAMILIA y no por nombre exacto, porque los perímetros de la
 * base no están normalizados: `Cintura natural`, `Cintura ombligo` y
 * `Cintura media` son los tres una cintura. Exigir el literal `Cintura` dejaba
 * fuera a gente que se había medido hace una semana — y bloquear a quien SÍ
 * tiene el dato es peor que no bloquear a nadie.
 */
function cubre(clave: string, exigido: string): boolean {
  const c = normalizar(clave)
  const e = normalizar(exigido)
  const familias = [e, ...(SINONIMOS[e] ?? [])]
  return familias.some(f => c === f || c.startsWith(`${f} `) || c === `${f}s`)
}

function diasEntre(desdeIso: string, hastaIso: string): number | undefined {
  const desde = Date.parse(`${desdeIso}T00:00:00Z`)
  const hasta = Date.parse(`${hastaIso}T00:00:00Z`)
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return undefined
  return Math.round((hasta - desde) / MS_POR_DIA)
}

/** La más reciente por fecha, que no siempre es la última del array. */
function medidaMasReciente(medidas: readonly MedidaCorporal[]): MedidaCorporal | undefined {
  let mejor: MedidaCorporal | undefined
  for (const m of medidas) {
    if (!Number.isFinite(Date.parse(`${m.fecha}T00:00:00Z`))) continue
    if (mejor === undefined || m.fecha > mejor.fecha) mejor = m
  }
  return mejor
}

/**
 * Decide si la persona puede ver su plan de entrenamiento.
 *
 * @param perfil            su perfil, o `undefined` si todavía no ha sincronizado
 * @param hoyIso            fecha de hoy en `YYYY-MM-DD`
 * @param perimetrosExtra   los que el coach exige por su objetivo (p. ej. `['Glúteo']`)
 */
export function evaluarRequisitoMedidas(
  perfil: Perfil | undefined,
  hoyIso: string,
  perimetrosExtra: readonly string[] = [],
): RequisitoMedidas {
  // Sin perfil no hay certeza de que falte nada. No se bloquea por no saber:
  // dejar a alguien fuera de su sesión porque la nube tardó sería peor que el
  // problema que esto resuelve.
  if (perfil === undefined) {
    return { cumple: true, faltan: [], vencida: false, indeterminado: true }
  }

  const exigidos: string[] = [...PERIMETROS_BASE]
  for (const extra of perimetrosExtra) {
    const yaEsta = exigidos.some(e => normalizar(e) === normalizar(extra))
    if (!yaEsta) exigidos.push(extra)
  }

  const ultima = medidaMasReciente(perfil.medidas ?? [])

  if (ultima === undefined) {
    return {
      cumple: false,
      faltan: ['Peso', 'Altura', ...exigidos],
      vencida: perfil.medidas?.length ? true : false,
    }
  }

  const faltan: string[] = []
  if (!(ultima.pesoKg > 0)) faltan.push('Peso')
  if (!(ultima.alturaCm > 0)) faltan.push('Altura')

  const medidos = Object.entries(ultima.perimetros ?? {})
  for (const exigido of exigidos) {
    const cubierto = medidos.some(
      ([clave, valor]) => typeof valor === 'number' && valor > 0 && cubre(clave, exigido),
    )
    if (!cubierto) faltan.push(exigido)
  }

  const diasDesdeUltima = diasEntre(ultima.fecha, hoyIso)
  const vencida = diasDesdeUltima === undefined || diasDesdeUltima > DIAS_VIGENCIA

  return {
    cumple: faltan.length === 0 && !vencida,
    faltan,
    vencida,
    diasDesdeUltima,
  }
}
