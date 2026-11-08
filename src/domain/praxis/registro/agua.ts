/**
 * Agua dictada: vasos × 200 mL (Res. 810), tazas, litros, botellas con tamaño, y varias cosas sumadas.
 * Medición del 7-nov-2026 (vida-agua.test.ts y vida-dictado.test.ts). Una botella sin tamaño se pregunta, no se inventa;
 * un rango («2 o 3 vasos») se pregunta con los dos, no se anota el primero.
 */
import { normalizarTexto, numeroDeCita, type NumeroDeCita } from './numeros.ts'
import { buscarRango, separarPegado, variantesDeRango } from './dictado.ts'
import { revisarAguaDeltaMl } from './limites.ts'
import { VASO_ML } from './medidas.ts'
import type { ContextoRegistro, Pregunta, RegistroHidratacion } from './tipos.ts'

/**
 * Trozos del agua dicha, ya normalizados («tres vasos, una botella de 600 y medio litro» → 3 trozos).
 * La coma decimal («1,5 litros») se vuelve punto ANTES de partir por comas. «X y medio / y media / y cuarto» suma esa
 * fracción de la unidad; «vasito» es un vaso, «cc» son mL y «2L», «2 lts» son litros.
 */
export function segmentosDeAgua(dicho: string): string[] {
  return dicho
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(/,|\+/)
    .map((t) =>
      separarPegado(normalizarTexto(t))
        .replace(/\bvasitos?\b/g, (m) => m.replace('vasito', 'vaso'))
        .replace(/\bcc\b/g, 'ml')
        .replace(/\b(l|lt|lts)\b/g, 'litros')
        .replace(/\b(\S+) (litros?|vasos?|tazas?) y (medio|media|cuarto)\b/g, (m, n: string, u: string, f: string) => {
          const c = numeroDeCita(n)
          return c ? `${c.valor + (f === 'cuarto' ? 0.25 : 0.5)} ${u}` : m
        })
        .replace(/\blitro y medio\b/, '1.5 litros')
        .replace(/\blitro y cuarto\b/, '1.25 litros')
        .replace(/\bmedio litro\b/, '0.5 litros')
        .replace(/\b(vaso|taza) y (medio|media)\b/g, '1.5 $1s'),
    )
    .flatMap((t) => t.split(/\by\b/))
    .map((x) => x.trim())
    .filter(Boolean)
}

type Lectura = { ml: number; parte: string } | 'sinTamano' | null
type Regla = (seg: string, cant: NumeroDeCita | null) => Lectura

const por = (n: number) => (n > 1 ? `${n} × ` : '')

const botellaDeLitros: Regla = (seg) => {
  const m = seg.match(/\bbotellas?\s+de\s+(\d+(?:\.\d+)?)\s*litros?\b/)
  if (!m) return null
  const n = numeroDeCita(seg.split(/\bbotellas?\b/)[0])?.valor ?? 1
  return { ml: Math.round(Number(m[1]) * 1000 * n), parte: `${por(n)}botella de ${m[1]} L` }
}
const botellaDeMl: Regla = (seg, cant) => {
  const m = seg.match(/\bbotellas?\s+de\s+(\d{2,4})\b/)
  if (!m) return null
  const n = cant && cant.valor !== Number(m[1]) ? cant.valor : 1
  return { ml: Number(m[1]) * n, parte: `${por(n)}botella de ${m[1]} mL` }
}
/** «5 vasos de 250 ml»: el tamaño que dijo manda sobre los 200 mL del vaso. */
const vasosDeTamano: Regla = (seg, cant) => {
  const m = seg.match(/\b(?:vasos?|tazas?)\s+de\s+(\d{2,4})\b/)
  if (!m) return null
  const n = cant?.valor ?? 1
  return { ml: Number(m[1]) * n, parte: `${n} × ${m[1]} mL` }
}
/** «un litro 200 ml» = 1.200. */
const litrosYMl: Regla = (seg) => {
  const m = seg.match(/\b(\d+)\s*(?:ml|mililitros?)\b/)
  if (!m || !/\blitros?\b/.test(seg)) return null
  const l = numeroDeCita(seg.split(/\blitros?\b/)[0])
  if (!l) return null
  return { ml: l.valor * 1000 + Number(m[1]), parte: `${l.valor} L + ${m[1]} mL` }
}
const enMl: Regla = (seg, cant) =>
  /\b(ml|mililitros?)\b/.test(seg) && cant ? { ml: cant.valor, parte: `${cant.valor} mL` } : null
const enLitros: Regla = (seg, cant) =>
  /\blitros?\b/.test(seg) && cant ? { ml: cant.valor * 1000, parte: `${cant.valor} L` } : null
const sinTamanoDicho: Regla = (seg) => (/\b(botellas?|termo|garrafa)/.test(seg) ? 'sinTamano' : null)
const enVasos: Regla = (seg, cant) =>
  /\b(vasos?|tazas?)\b/.test(seg) && cant ? { ml: cant.valor * VASO_ML, parte: `${cant.valor} × ${VASO_ML} mL` } : null

const REGLAS: Regla[] = [botellaDeLitros, botellaDeMl, vasosDeTamano, litrosYMl, enMl, enLitros, sinTamanoDicho, enVasos]

/** Mililitros del agua dicha; una botella sin tamaño marca `sinTamano`. */
export function mlDeAgua(dicho: string): { ml: number; partes: string[]; sinTamano: boolean } {
  let ml = 0
  const partes: string[] = []
  let sinTamano = false
  for (const seg of segmentosDeAgua(dicho)) {
    const cant = numeroDeCita(seg)
    for (const regla of REGLAS) {
      const l = regla(seg, cant)
      if (l === null) continue
      if (l === 'sinTamano') sinTamano = true
      else { ml += l.ml; partes.push(l.parte) }
      break
    }
  }
  return { ml, partes, sinTamano }
}

/** Si dijo cero o nada, no se anota ni se pregunta cuánta (medición 7-nov). */
const DIJO_CERO = /\b(0|cero|nada|ningun[oa]?|no)\b/

export interface ResultadoAgua {
  registros: RegistroHidratacion[]
  descartado: { cita: string; motivo: string }[]
  seguimiento?: Pregunta
  avisos: string[]
}

const PREGUNTA_CUANTA: Pregunta = {
  texto: '¿Cuánta agua fue? Puedes decirlo en vasos, litros o ml.', opciones: ['Un vaso', 'Dos vasos', 'Un litro'], campo_bloqueante: 'agua_cantidad',
}
const PREGUNTA_BOTELLA: Pregunta = {
  texto: '¿De cuántos ml es tu botella (o si no sabes, pequeña, mediana o grande)?', opciones: ['Pequeña', 'Mediana', 'Grande'], campo_bloqueante: 'botella_ml',
}

/** El agua de la frase: un registro, una pregunta (botella sin tamaño, rango, no se entendió cuánta) o un descarte. */
export function resolverAgua(agua: { cantidad: string; medida: string | null }, ctx: ContextoRegistro, hoy: string): ResultadoAgua {
  const dicho = `${agua.cantidad} ${agua.medida ?? ''}`.trim()
  const salida: ResultadoAgua = { registros: [], descartado: [], avisos: [] }
  const rango = buscarRango(normalizarTexto(dicho.replace(/(\d),(\d)/g, '$1.$2')))
  if (rango) {
    salida.seguimiento = { texto: `Dijiste «${dicho}»: ¿cuál fue?`, opciones: variantesDeRango(rango), campo_bloqueante: 'agua_cantidad' }
    return salida
  }
  const { ml, partes, sinTamano } = mlDeAgua(dicho)
  if (sinTamano) salida.seguimiento = PREGUNTA_BOTELLA
  else if (ml > 0) {
    const ver = revisarAguaDeltaMl(ml, ctx.hidratacionHoyMl ?? 0)
    if (ver.tipo === 'imposible') salida.descartado.push({ cita: agua.cantidad, motivo: ver.motivo })
    else {
      if (ver.tipo === 'aviso') salida.avisos.push(ver.aviso)
      salida.registros.push({ campo: 'hidratacion', fecha: hoy, delta_ml: ml, confianza: 'media', detalle: partes.join(' + ') })
    }
  } else if (!DIJO_CERO.test(normalizarTexto(dicho))) salida.seguimiento = PREGUNTA_CUANTA
  return salida
}
