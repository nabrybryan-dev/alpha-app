/**
 * Números en letras y en cifras, del español de Colombia.
 *
 * REGLA DE ORO DEL MÓDULO: aquí nunca se INVENTA un número. Cada función recibe
 * una CITA (un fragmento literal de lo que dijo la persona) y devuelve el número
 * que esa cita contiene, o `null` si no contiene ninguno. El modelo solo cita;
 * quien pasa «cuarenta y cinco» a 45 es este archivo, con tests.
 *
 * es-CO: la coma es el separador decimal («80,2») y el punto separa miles
 * («12.350»). Un punto con exactamente tres dígitos detrás es de miles; con uno
 * o dos, decimal («12.5»).
 */

/** Minúsculas, sin tildes, sin puntuación (salvo la que forma números). */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d)\s*½/g, '$1 y medio')
    .replace(/½/g, ' medio ')
    .replace(/[^a-z0-9.,/\s]/g, ' ')
    // Coma o punto al final de una palabra o número («cuarenta,» «12.») no es decimal.
    .replace(/[.,]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
}
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
  trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500,
  quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700,
  setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900,
  novecientas: 900,
}

/** Una cifra escrita con dígitos, o `null` si el token no lo es. */
export function valorLiteral(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token)
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) return Number(token.replace(/\./g, ''))
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(token)) return Number(token.replace(/\./g, '').replace(',', '.'))
  if (/^\d+[.,]\d+$/.test(token)) return Number(token.replace(',', '.'))
  if (/^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split('/').map(Number)
    return b ? a / b : null
  }
  return null
}

const ES_PALABRA_NUMERICA = (t: string): boolean =>
  t in UNIDADES || t in DECENAS || t in CENTENAS ||
  t === 'mil' || t === 'medio' || t === 'media' || t === 'cuarto' || t === 'cuartos' || t === 'par'

/** «una taza y media», «ocho horas y media»: el «y media» se pega a la unidad, no al número. */
const UNIDAD_CON_MEDIA = /^(tazas?|vasos?|platos?|cucharadas?|cucharaditas?|litros?|kilos?|libras?|horas?|botellas?|tajadas?|panes?|presas?|pedazos?)$/

function conMediaDespuesDeUnidad(tokens: string[], v: number, j: number): { v: number; j: number } {
  if (Number.isInteger(v) && UNIDAD_CON_MEDIA.test(tokens[j] ?? '') && tokens[j + 1] === 'y' && (tokens[j + 2] === 'medio' || tokens[j + 2] === 'media')) {
    return { v: v + 0.5, j: j + 3 }
  }
  return { v, j }
}

export interface NumeroEncontrado {
  valor: number
  /** Índice del primer token y del siguiente al último, en la frase normalizada. */
  desde: number
  hasta: number
}

/** Todos los números de un texto, en orden de aparición. */
export function escanearNumeros(texto: string): NumeroEncontrado[] {
  const tokens = normalizarTexto(texto).split(' ').filter(Boolean)
  const salida: NumeroEncontrado[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    const lit = valorLiteral(t)
    if (lit !== null) {
      let v = lit
      let j = i + 1
      if (tokens[j] === 'y' && (tokens[j + 1] === 'medio' || tokens[j + 1] === 'media')) {
        v += 0.5
        j += 2
      } else if (tokens[j] === 'mil' && v < 1000) {
        v *= 1000
        j += 1
      }
      ;({ v, j } = conMediaDespuesDeUnidad(tokens, v, j))
      salida.push({ valor: v, desde: i, hasta: j })
      i = j
      continue
    }
    if (ES_PALABRA_NUMERICA(t)) {
      let total = 0
      let cur = 0
      let visto = false
      let j = i
      while (j < tokens.length) {
        const w = tokens[j]
        if (w === 'y') {
          const sig = tokens[j + 1]
          // «y» une cuarenta y cinco / uno y medio; en otro sitio corta el número.
          if (visto && sig !== undefined && (sig in UNIDADES || sig === 'medio' || sig === 'media')) {
            j += 1
            continue
          }
          break
        }
        if (w in UNIDADES) { cur += UNIDADES[w]; visto = true }
        else if (w in DECENAS) { cur += DECENAS[w]; visto = true }
        else if (w in CENTENAS) { cur += CENTENAS[w]; visto = true }
        else if (w === 'mil') { cur = (cur || 1) * 1000; total += cur; cur = 0; visto = true }
        else if (w === 'medio' || w === 'media') { cur += 0.5; visto = true }
        else if (w === 'cuarto' || w === 'cuartos') { cur = (cur || 1) * 0.25; visto = true }
        else if (w === 'par') { cur = 2; visto = true }
        else break
        j += 1
      }
      // «un 9», «una 70»: el artículo delante de una cifra no es un número.
      const articulo = j - i === 1 && (t === 'un' || t === 'una' || t === 'uno') && valorLiteral(tokens[j] ?? '') !== null
      if (visto && !articulo) {
        const m = conMediaDespuesDeUnidad(tokens, total + cur, j)
        salida.push({ valor: m.v, desde: i, hasta: m.j })
        j = m.j
      }
      i = Math.max(j, i + 1)
      continue
    }
    i += 1
  }
  return salida
}

const APROXIMADOR = /\b(como|casi|aprox\w*|unos|unas|algo asi|mas o menos|un par)\b/

const APROXIMADOR_SUELTO = /\b(como|casi|aprox\w*|unos|unas|alrededor de|cerca de|mas o menos|algo asi)\b/g

export interface NumeroDeCita {
  valor: number
  /** «como 5», «unos 8», «más o menos»: la persona misma dudó. */
  aproximado: boolean
}

/**
 * El primer número de la cita, o `null` si no hay ninguno o la persona lo dejó
 * abierto («y pico»). Nunca adivina: «bastante» no es un número.
 */
export function numeroDeCita(cita: string | null | undefined): NumeroDeCita | null {
  if (!cita) return null
  const norm = normalizarTexto(cita)
  if (/\by pico\b/.test(norm)) return null
  const encontrados = escanearNumeros(cita)
  if (encontrados.length === 0) return null
  return { valor: encontrados[0].valor, aproximado: APROXIMADOR.test(norm) }
}

/** Atajo: el número o `null`. */
export function valorDeCita(cita: string | null | undefined): number | null {
  return numeroDeCita(cita)?.valor ?? null
}

/** «primera», «tercera», «última»... → número de orden. `'ultima'` se devuelve aparte. */
export function ordinalDeCita(cita: string | null | undefined): number | 'ultima' | 'otra' | null {
  if (!cita) return null
  const n = normalizarTexto(cita)
  if (/\bultim[oa]\b/.test(n)) return 'ultima'
  if (/\botra\b/.test(n)) return 'otra'
  const mapa: [RegExp, number][] = [
    [/\bprimer[oa]?\b/, 1], [/\bsegund[oa]\b/, 2], [/\btercer[oa]?\b/, 3],
    [/\bcuart[oa]\b/, 4], [/\bquint[oa]\b/, 5], [/\bsext[oa]\b/, 6],
    [/\bseptim[oa]\b/, 7], [/\boctav[oa]\b/, 8],
  ]
  for (const [re, v] of mapa) if (re.test(n)) return v
  return valorDeCita(cita)
}

/**
 * Minutos de una duración dicha: «una hora y diez» → 70, «media hora» → 30,
 * «45 minutos» → 45, «hora y media» → 90, «dos horas» → 120.
 */
export function minutosDeCita(cita: string | null | undefined): number | null {
  if (!cita) return null
  const n = normalizarTexto(cita)
  if (/\bmedia hora\b/.test(n)) return 30
  const m = n.match(/^(.*?)\bhoras?\b(.*)$/)
  if (m) {
    // «como hora y media», «unas dos horas»: el aproximador no es la cantidad.
    const antes = m[1].replace(APROXIMADOR_SUELTO, ' ').replace(/\s+/g, ' ').trim()
    const despues = m[2].trim()
    const horas = antes ? valorDeCita(antes) : 1
    if (horas === null) return null
    let extra = 0
    if (despues) {
      const d = despues.replace(/^y\s+/, '')
      if (/^media\b/.test(d)) extra = 30
      else if (/^cuarto\b/.test(d) || /^un cuarto\b/.test(d)) extra = 15
      else {
        const v = valorDeCita(d)
        if (v !== null) extra = v
      }
    }
    return Math.round(horas * 60 + extra)
  }
  if (/\bmin/.test(n) || /^\S+$/.test(n)) return valorDeCita(n)
  return null
}

/**
 * `HH:MM` de una hora dicha. `contexto` decide la mañana o la noche cuando la
 * persona no lo dijo: acostarse entre las 6 y las 11 es de la noche («a las
 * once» = 23:00); levantarse es de la mañana.
 */
export function horaDeCita(cita: string | null | undefined, contexto: 'acostarse' | 'levantarse'): string | null {
  if (!cita) return null
  const n = normalizarTexto(cita)
  let hora: number
  let min = 0
  // El reloj se busca en la cita CRUDA: `normalizarTexto` cambia los dos puntos por un
  // espacio, y entonces «11:75» se leía como «11» y «75», el 75 se descartaba por no caber
  // en los minutos y salía 23:00: una hora que nadie dijo. Con el reloj visto, los minutos
  // imposibles llegan a la comprobación de abajo y la cita se rechaza.
  const reloj = cita.match(/\b(\d{1,2})[:.](\d{2})\b/)
  if (reloj) {
    hora = Number(reloj[1])
    min = Number(reloj[2])
  } else {
    // «y media» / «y cuarto» / «menos cuarto» se leen aparte para que no se
    // cuelen en el número de la hora (cinco y media no es 5,5).
    const yMedia = /\by media\b/.test(n)
    const yCuarto = /\by cuarto\b/.test(n)
    const menosCuarto = /\bmenos cuarto\b/.test(n)
    const limpio = n.replace(/\b(y media|y cuarto|menos cuarto)\b/g, ' ')
    const encontrados = escanearNumeros(limpio)
    if (encontrados.length === 0) return null
    hora = encontrados[0].valor
    if (!Number.isInteger(hora)) return null
    if (yMedia) min = 30
    else if (yCuarto) min = 15
    else if (menosCuarto) { min = 45; hora -= 1 }
    else {
      const resto = encontrados[1]
      if (resto && Number.isInteger(resto.valor) && resto.valor > 0 && resto.valor < 60) min = resto.valor
    }
  }
  if (hora < 0 || hora > 24 || min > 59) return null
  const pm = /\b(pm|p m|de la noche|de la tarde|noche|tarde)\b/.test(n)
  const am = /\b(am|a m|de la manana|manana|madrugada)\b/.test(n)
  if (pm && hora < 12) hora += 12
  else if (am && hora === 12) hora = 0
  else if (!pm && !am && contexto === 'acostarse') {
    if (hora >= 6 && hora <= 11) hora += 12
    else if (hora === 12) hora = 0
  }
  hora = hora % 24
  return `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Redondea a un decimal (las cargas de la app son múltiplos de 0,5 o 0,1). */
export function redondear1(n: number): number {
  return Math.round(n * 10) / 10
}
