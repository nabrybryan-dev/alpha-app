/**
 * Cómo dice las cosas CADA persona (paso 5 del diseño de los conectores). PURO: sin red ni base; el guardado va por
 * la migración 0171 (`praxis_aprender_forma`), sin aplicar.
 *
 * Reglas (diseño §5, propuestas por Claude el 7-nov; Bryan eligió construirlo):
 *  - Se guarda SOLO la expresión vaga normalizada («como medio»), el campo y el valor que la persona eligió. Nunca la
 *    frase entera ni nada de salud: hambre, dolor y horas no aprenden (no salen de palabras).
 *  - Tres elecciones IGUALES seguidas para la misma forma y campo → la tarjeta llega con ese valor marcado y la marca
 *    «como lo dices tú». Una elección distinta vuelve la cuenta a 1 con el valor nuevo.
 *  - Nunca evita la confirmación: solo cambia qué llega marcado. Y solo entre las opciones que la frase admite.
 *  - Es de una persona: el lexicón de A no se usa con B, y no entra al entrenamiento del modelo propio.
 */
import { formaVaga } from './conectores.ts'
import type { CampoCheckin } from './mensajeLargo.ts'
import type { FilaTarjeta, TarjetaCheckin } from './tarjetaCheckin.ts'

/** Campos que pueden aprender: los de tres niveles. */
export const CAMPOS_QUE_APRENDEN: readonly CampoCheckin[] = ['rendimiento', 'motivacion', 'cansancio', 'estres', 'calidadSueno', 'alimentacion']

/** Elecciones iguales seguidas que hacen falta para llegar marcado. */
export const CONFIRMACIONES_PARA_MARCAR = 3

export interface FormaAprendida { campo: CampoCheckin; forma: string; valor: string; confirmaciones: number }
export type LexicoPersona = readonly FormaAprendida[]

const clave = (campo: CampoCheckin, forma: string) => `${campo}|${forma}`

/** Lo que hay que mandar a guardar cuando la persona toca una opción en una fila vaga. `null` = no se aprende. */
export function aprendizajeDeEleccion(fila: Pick<FilaTarjeta, 'campo' | 'cita' | 'origen'>, valor: string | number): { campo: CampoCheckin; forma: string; valor: string } | null {
  if (!CAMPOS_QUE_APRENDEN.includes(fila.campo) || typeof valor !== 'string') return null
  if (fila.origen === 'tabla') return null
  const f = formaVaga(fila.cita)
  return f ? { campo: fila.campo, forma: f.forma, valor } : null
}

/** El lexicón tras una elección (lo mismo que hará la función de la base). Copia, no muta. */
export function aprender(lexico: LexicoPersona, e: { campo: CampoCheckin; forma: string; valor: string }): FormaAprendida[] {
  const previa = lexico.find((x) => clave(x.campo, x.forma) === clave(e.campo, e.forma))
  const nueva: FormaAprendida = previa && previa.valor === e.valor
    ? { ...previa, confirmaciones: previa.confirmaciones + 1 }
    : { ...e, confirmaciones: 1 }
  return [...lexico.filter((x) => x !== previa), nueva]
}

export type FilaConPersona = FilaTarjeta & { comoLoDicesTu?: true }

/** Marca, en las filas vagas, el valor que la persona ya eligió tres veces seguidas. Solo entre lo que la fila admite. */
export function aplicarLexico(t: TarjetaCheckin, lexico: LexicoPersona): TarjetaCheckin & { filas: FilaConPersona[] } {
  const filas = t.filas.map((f): FilaConPersona => {
    if (f.origen === 'tabla') return f
    const forma = formaVaga(f.cita)?.forma
    const aprendida = forma ? lexico.find((x) => x.campo === f.campo && x.forma === forma) : undefined
    if (!aprendida || aprendida.confirmaciones < CONFIRMACIONES_PARA_MARCAR) return f
    const admitidas = f.candidatos.length > 0 ? f.candidatos : f.opciones
    if (!admitidas.includes(aprendida.valor)) return f
    return { ...f, marcado: aprendida.valor, comoLoDicesTu: true }
  })
  return { ...t, filas }
}
