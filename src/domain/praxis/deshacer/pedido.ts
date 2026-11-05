import type { TipoRegistroLibro } from './tipos'

/** Lo que la persona pidió quitar, leído con una gramática cerrada (sin modelo). */
export interface PedidoDeshacer {
  tipo?: TipoRegistroLibro
  /** Minutos locales dichos («de las 10» = 600). */
  minutoDicho?: number
  /** Pidió más de uno («los tres últimos», «todo»): se contesta «de a uno». */
  pideVarios: boolean
  /** «lo último» elige el más reciente; «eso/esto» no sabe a cuál se refiere y pregunta si hay dudas. */
  referencia: 'ultimo' | 'eso'
}

const quitarTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

const TIPOS: Array<[RegExp, TipoRegistroLibro]> = [
  [/^(?:el )?agua$/, 'hidratacion'],
  [/^(?:la |el )?(?:comida|desayuno|almuerzo|cena)$/, 'comida'],
  [/^(?:las? )?series?$/, 'series'],
  [/^(?:la )?adherencia$/, 'adherencia'],
  [/^(?:el )?check-?in$/, 'checkin'],
]

/**
 * Devuelve el pedido solo si la frase EMPIEZA con la orden y el objeto está en la lista cerrada.
 * «mi hermano borró todo» o «toca borrar fotos» no empiezan con la orden: devuelven null.
 */
export function interpretarPedidoDeshacer(frase: string): PedidoDeshacer | null {
  const t = quitarTildes(frase.toLowerCase()).replace(/[¡!¿?.]/g, ' ').replace(/\s+/g, ' ').trim()
  const m = /^(?:por favor,? )?(?:deshaz|deshacer|deshace|quita|quitame|borra|borrame|elimina)(?: por favor)? (.+)$/.exec(t)
  if (!m) return null
  const objeto = m[1].replace(/ por favor$/, '')

  if (/^(?:eso|esto)$/.test(objeto)) return { pideVarios: false, referencia: 'eso' }
  if (/^(?:lo ultimo|el ultimo registro|lo ultimo que anote|lo que acabo de anotar|lo que anote)$/.test(objeto)) {
    return { pideVarios: false, referencia: 'ultimo' }
  }
  if (/^(?:todo|los (?:dos|tres|cuatro|cinco|\d+) ultimos(?: registros)?|todo lo que anote)$/.test(objeto)) {
    return { pideVarios: true, referencia: 'ultimo' }
  }
  const d = /^lo (?:del|de) (?:la |el |las |los )?([a-z-]+?)(?: de las (\d{1,2})(?::(\d{2}))?(?: de la (manana|tarde|noche))?)?$/.exec(objeto)
  if (d) {
    const palabra = d[1]
    const tipo = TIPOS.find(([re]) => re.test(palabra))?.[1]
    if (!tipo) return null
    if (d[2] === undefined) return { tipo, pideVarios: false, referencia: 'ultimo' }
    let h = Number(d[2])
    const min = d[3] === undefined ? 0 : Number(d[3])
    if (h > 23 || min > 59) return null
    if ((d[4] === 'tarde' || d[4] === 'noche') && h < 12) h += 12
    return { tipo, minutoDicho: h * 60 + min, pideVarios: false, referencia: 'eso' }
  }
  return null
}
