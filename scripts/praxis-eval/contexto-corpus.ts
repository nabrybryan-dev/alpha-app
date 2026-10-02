/**
 * Convierte el texto libre de `contexto` del corpus en un `ContextoRegistro`.
 *
 * El corpus describe el estado en prosa («Sesión de hoy S1 PIERNA. Ejercicios: pa1
 * SENTADILLA TRASERA (4 series, 8-12, kg, pauta 12@60, ...). Series hechas: pa1
 * completa (4/4)...»). En producción ese estado sale del microciclo real
 * (`contexto.ts`); aquí se reconstruye del texto para poder correr el MISMO
 * camino (armarContextoParaModelo → modelo → resolutores) sobre el corpus.
 *
 * Es un parser de mejor esfuerzo hecho para ESTE corpus: no es una gramática
 * general. Un test (`contexto-corpus.test.ts`) comprueba que los 80 casos CE
 * salen con las sesiones y series que dice el texto.
 */
import type {
  ComidaCtx, ContextoRegistro, EjercicioCtx, ItemComidaCtx, SerieHecha, SeriePauta, SesionCtx, UnidadCarga,
} from '../../src/domain/praxis/registro/tipos.ts'

const MESES: Record<string, string> = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' }
const num = (s: string): number => Number(s.replace(',', '.'))

function ahoraDe(texto: string): string {
  const f = texto.match(/\b(\d{1,2})-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i)
  const fecha = f ? `2026-${MESES[f[2].toLowerCase()]}-${f[1].padStart(2, '0')}` : '2026-09-28'
  // Hora: «18:40», «7:30 am», «6 pm».
  const conMin = texto.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  const sinMin = texto.match(/,\s*(\d{1,2})\s*(am|pm)\b/i)
  let h = 12
  let m = 0
  let ampm: string | undefined
  if (conMin) { h = Number(conMin[1]); m = Number(conMin[2]); ampm = conMin[3]?.toLowerCase() }
  else if (sinMin) { h = Number(sinMin[1]); ampm = sinMin[2].toLowerCase() }
  if (ampm === 'pm' && h < 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  return `${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-05:00`
}

/** Un ítem de comida en prosa: «150 g arroz», «2 huevos (100 g)», «1 arepa delgada 56 g», «tinto con 23 g azucar». */
export function itemDeComida(t: string): ItemComidaCtx {
  const txt = t.trim().replace(/\.$/, '')
  let m = txt.match(/^(?:\d+(?:[.,]\d+)?(?:\/\d+)?\s+)?(.+?)\s*\((\d+(?:[.,]\d+)?) g\)$/)
  if (m) return { alimento: m[1].trim(), gramos: num(m[2]) }
  m = txt.match(/^(\d+(?:[.,]\d+)?) g (.+)$/)
  if (m) return { alimento: m[2].trim(), gramos: num(m[1]) }
  m = txt.match(/^\d+\s+(.+?)\s+(\d+(?:[.,]\d+)?) g$/)
  if (m) return { alimento: m[1].trim(), gramos: num(m[2]) }
  return { alimento: txt, gramos: null }
}

function comidasDeTexto(texto: string): { ayer: ComidaCtx[]; pendiente: ItemComidaCtx[] } {
  const ayer: ComidaCtx[] = []
  for (const m of texto.matchAll(/Ayer (desayuno|almuerzo|cena|snack)(?: registrado)?: (.*?)\.(?:\s|$)/g)) {
    ayer.push({ comida: m[1] as ComidaCtx['comida'], items: m[2].split(/,\s+(?![^()]*\))/).map(itemDeComida) })
  }
  const p = texto.match(/Tarjeta pendiente sin confirmar: (.*?)\.(?:\s|$)/)
  return { ayer, pendiente: p ? p[1].split(/,\s+(?![^()]*\))/).map(itemDeComida) : [] }
}

function unidadDe(atributos: string): UnidadCarga | null {
  if (/\bpor[_ ]mano\b/.test(atributos)) return 'por_mano'
  if (/\bpor[_ ]lado\b/.test(atributos)) return 'por_lado'
  if (/\bcorporal\b/.test(atributos)) return 'corporal'
  if (/\bbanda\b/.test(atributos)) return 'banda'
  if (/\btotal\b/.test(atributos)) return 'total'
  if (/\bkg\b/.test(atributos)) return 'kg'
  return null
}

function ejercicioDe(id: string, nombre: string, atributos: string, sesionId: string): EjercicioCtx {
  const sets = Number(atributos.match(/(\d+) series/)?.[1] ?? 3)
  const rango = atributos.match(/(\d+-\d+)/)?.[1]
  const sinPauta = atributos.replace(/(pauta|seriesPrescritas)\s.*$/, '')
  const partes = sinPauta.split(',').map((p) => p.trim())
  const unidad = unidadDe(atributos)
  // reps de diana: primer número suelto tras «N series» (o el tope del rango)
  const repsTxt = partes[1]
  const repsDiana = repsTxt ? (repsTxt.match(/(\d+)-(\d+)/) ? Number(repsTxt.match(/(\d+)-(\d+)/)![2]) : /^\d+$/.test(repsTxt) ? Number(repsTxt) : undefined) : undefined
  // carga: número suelto tras la unidad
  const idxUni = partes.findIndex((p) => /^(kg|por[_ ]mano|por[_ ]lado|total|kg total|corporal|banda|unidadCarga.*)$/.test(p))
  const cargaTxt = idxUni >= 0 ? partes[idxUni + 1] : undefined
  const cargaKg = cargaTxt && /^\d+([.,]\d+)?$/.test(cargaTxt) ? num(cargaTxt) : undefined

  let seriesPrescritas: SeriePauta[] | undefined
  const pauta = atributos.match(/(?:pauta|seriesPrescritas)\s+(.*)$/)?.[1]
  if (pauta) {
    const enLas = pauta.match(/^(\d+)@(\d+(?:[.,]\d+)?)\s+en las (\d+)/)
    if (enLas) {
      seriesPrescritas = Array.from({ length: Number(enLas[3]) }, (_, i) => ({ orden: i + 1, reps: Number(enLas[1]), cargaKg: num(enLas[2]) }))
    } else {
      const trozos = [...pauta.matchAll(/(\d+)@(\d+(?:[.,]\d+)?)/g)]
      if (trozos.length) seriesPrescritas = trozos.map((t, i) => ({ orden: i + 1, reps: Number(t[1]), cargaKg: num(t[2]) }))
    }
  }
  const soloCarga = !seriesPrescritas && pauta && /^\d+([.,]\d+)?$/.test(pauta.trim()) ? num(pauta.trim()) : undefined
  return {
    id, nombre, sesionId, sets, unidad, rango,
    ...(seriesPrescritas ? { seriesPrescritas } : {}),
    ...(cargaKg !== undefined ? { cargaKg } : soloCarga !== undefined ? { cargaKg: soloCarga } : {}),
    ...(repsDiana !== undefined ? { repsDiana } : {}),
    series: [],
  }
}

/** pb1 a pb5 → [pb1..pb5]; «pa1, pa2 y pa3» → [pa1,pa2,pa3]. */
function idsDe(frase: string): string[] {
  const ids: string[] = []
  const rango = frase.match(/\b([a-z]{1,3})(\d+) a ([a-z]{1,3})(\d+)\b/)
  if (rango && rango[1] === rango[3]) {
    for (let i = Number(rango[2]); i <= Number(rango[4]); i++) ids.push(`${rango[1]}${i}`)
    return ids
  }
  for (const m of frase.matchAll(/\b([a-z]{1,3}\d+)\b/g)) ids.push(m[1])
  return [...new Set(ids)]
}

export function contextoDeCorpus(texto: string): ContextoRegistro {
  const ahora = ahoraDe(texto)
  const sesiones: SesionCtx[] = []
  let sesionHoyId: string | null = null

  const nombreSesion = String.raw`([A-ZÁÉÍÓÚÑ]+(?: [A-ZÁÉÍÓÚÑ]+)*)`
  // «Sesión de hoy S1 PIERNA» / «Sesión S2 EMPUJE sin fecha» / «existe solo en S3 TRACCION»
  const hoy = texto.match(new RegExp(String.raw`Sesi[oó]n de hoy (S\d+) ${nombreSesion}`))
  const otras = [...texto.matchAll(new RegExp(String.raw`(?:Sesi[oó]n|en) (S\d+) ${nombreSesion}`, 'g'))]
  const registrar = (id: string, nombre: string): SesionCtx => {
    let s = sesiones.find((x) => x.id === id)
    if (!s) { s = { id, nombre, ejercicios: [], bloquesCardio: [] }; sesiones.push(s) }
    return s
  }
  if (hoy) { registrar(hoy[1], hoy[2]); sesionHoyId = hoy[1] }
  for (const o of otras) registrar(o[1], o[2])

  // Sesiones estilo V/D: «Sesion de hoy: Pierna A (sentadilla 4x8 @60 kg, prensa 3x10)».
  const cardioV = texto.match(/Sesion de hoy: bloque cardio (\d+) min[^.]*? en (\w+)/)
  if (cardioV && !hoy) {
    const s = registrar('SV', 'Cardio')
    sesionHoyId = 'SV'
    s.bloquesCardio?.push({ id: 'cd1', nombre: cardioV[2].toUpperCase(), duracionMin: Number(cardioV[1]) })
  }
  const sv = cardioV ? null : texto.match(/Sesion de hoy: ([^,(.]+?)(?:\s*\(([^)]*)\)|, ([^.]*))?\./)
  if (sv && !hoy) {
    const s = registrar('SV', sv[1].trim())
    sesionHoyId = 'SV'
    const items = (/^series registradas/i.test(sv[2] ?? '') ? '' : (sv[2] ?? sv[3] ?? '')).split(',').map((x) => x.trim()).filter((x) => x && !/^sin series/i.test(x) && !/^no /i.test(x))
    items.forEach((it, i) => {
      const ss = it.match(/^(.+?)(?:\s+(\d+)x(\d+))?(?:\s+@(\d+))?(?:\s+kg)?$/)
      if (!ss) return
      s.ejercicios.push({
        id: `sv${i + 1}`, nombre: ss[1].toUpperCase(), sesionId: 'SV', sets: ss[2] ? Number(ss[2]) : 3, unidad: 'kg',
        ...(ss[4] ? { cargaKg: Number(ss[4]) } : {}), ...(ss[3] ? { repsDiana: Number(ss[3]) } : {}), series: [],
      })
    })
  }

  // Cardio: «Bloque cardio cd1 CAMINADORA 20 min»
  const cardio = texto.match(/Bloque cardio (\w+) ([A-ZÁÉÍÓÚÑ ]+?) (\d+) min/)
  if (cardio) {
    const s = sesionHoyId ? sesiones.find((x) => x.id === sesionHoyId) : sesiones[0]
    s?.bloquesCardio?.push({ id: cardio[1], nombre: cardio[2].trim(), duracionMin: Number(cardio[3]) })
  }

  // Preparación: «Preparación: pr1 MOVILIDAD DE CADERA, pr2 ACTIVACION DE GLUTEO, sin marcar.»
  const prep = texto.match(/Preparaci[oó]n: ((?:[a-z]{1,3}\d+ [A-ZÁÉÍÓÚÑ ]+(?:, )?)+)/)
  if (prep) {
    const s = sesionHoyId ? sesiones.find((x) => x.id === sesionHoyId) : sesiones[0]
    if (s) {
      const marcadas = !/sin marcar/.test(texto)
      s.preparacion = prep[1].split(', ').map((it) => it.trim()).filter(Boolean).map((it) => {
        const m = it.match(/^([a-z]{1,3}\d+) (.+)$/)
        return { id: m?.[1] ?? it, nombre: (m?.[2] ?? it).trim(), hecha: marcadas }
      })
    }
  }

  // Ejercicios con atributos: «pa1 SENTADILLA TRASERA (4 series, ...)». Se asignan a la
  // sesión cuyo texto los precede; en CE-030 el remo es de S3 (la otra sesión).
  const conAtributos = /\b([a-z]{1,3}\d+) ([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ]*?) \(([^)]*\d+ series[^)]*)\)/g
  const posiciones = [...texto.matchAll(new RegExp(String.raw`(?:Sesi[oó]n(?: de hoy)?|en) (S\d+) `, 'g'))].map((m) => ({ id: m[1], pos: m.index ?? 0 }))
  for (const m of texto.matchAll(conAtributos)) {
    const pos = m.index ?? 0
    // La sesión del ejercicio: «existe solo en S3» → la cita que lo sigue; si no, la de hoy.
    const despues = texto.slice(pos + m[0].length, pos + m[0].length + 40).match(/existe solo en (S\d+)/)
    const previa = [...posiciones].reverse().find((p) => p.pos < pos)
    const sid = despues?.[1] ?? sesionHoyId ?? previa?.id ?? sesiones[0]?.id ?? 'S?'
    const s = registrar(sid, sesiones.find((x) => x.id === sid)?.nombre ?? sid)
    s.ejercicios.push(ejercicioDe(m[1], m[2].trim(), m[3], sid))
  }
  // «REMO CON BARRA (pc1, 4 series, 10, kg, 50) existe solo en S3 TRACCION»: otra sesión.
  for (const m of texto.matchAll(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+?) \(([a-z]{1,3}\d+), (\d+ series[^)]*)\) existe solo en (S\d+)/g)) {
    const s = registrar(m[4], sesiones.find((x) => x.id === m[4])?.nombre ?? m[4])
    s.ejercicios.push(ejercicioDe(m[2], m[1].trim(), m[3], m[4]))
  }
  // Ejercicios sin atributos, en lista entre paréntesis: «(pb1 PRESS BANCA PLANO, pb2 ...)».
  const lista = texto.match(/Sesi[oó]n de hoy S\d+ [A-ZÁÉÍÓÚÑ ]+ \(((?:[a-z]{1,3}\d+ [A-ZÁÉÍÓÚÑ ]+(?:, )?)+)\)/)
  if (lista && sesionHoyId) {
    const s = sesiones.find((x) => x.id === sesionHoyId)!
    for (const it of lista[1].split(', ')) {
      const p = it.match(/^([a-z]{1,3}\d+) (.+)$/)
      if (p && !s.ejercicios.some((e) => e.id === p[1])) s.ejercicios.push(ejercicioDe(p[1], p[2].trim(), '3 series', s.id))
    }
  }
  // Ejercicios que solo aparecen en «Series hechas»: «pc2 JALON AL PECHO con 3 series (...)».
  for (const m of texto.matchAll(/\b([a-z]{1,3}\d+) ([A-ZÁÉÍÓÚÑ ]{4,}?) con (\d+) series/g)) {
    const sid = sesionHoyId ?? sesiones[0]?.id ?? 'S?'
    const s = registrar(sid, sesiones.find((x) => x.id === sid)?.nombre ?? sid)
    if (!s.ejercicios.some((e) => e.id === m[1])) s.ejercicios.push(ejercicioDe(m[1], m[2].trim(), `${m[3]} series, kg`, sid))
  }

  const todos = sesiones.flatMap((s) => s.ejercicios)
  const porId = (id: string) => todos.find((e) => e.id === id)
  const sinteticas = (e: EjercicioCtx, n: number): SerieHecha[] =>
    Array.from({ length: n }, (_, i) => ({
      orden: i + 1,
      cargaKg: e.seriesPrescritas?.[i]?.cargaKg ?? e.cargaKg ?? 0,
      reps: e.seriesPrescritas?.[i]?.reps ?? e.repsDiana ?? 10,
    }))

  // Series hechas, oración por oración.
  let ultimoTocado: ContextoRegistro['ultimoTocado'] = null
  const bloque = texto.match(/Series hechas[^:]*:(.*)$/s)?.[1]
  if (bloque) {
    for (const oracion of bloque.split(/\.\s+/)) {
      if (/ninguna\b/.test(oracion) && !/pa\d.*completa/.test(oracion)) continue
      if (/^\s*(Ruta abierta|La app|Perfil|Mensaje|Cron)/.test(oracion)) continue
      const ids = idsDe(oracion).filter((i) => porId(i))
      if (ids.length === 0) continue
      if (/sin series/.test(oracion)) continue
      const explicitas = [...oracion.matchAll(/orden (\d+) = (\d+(?:[.,]\d+)?)\s*(?:kg\s*)?x\s*(\d+)/g)]
      const paren = oracion.match(/\(([^)]*\d+x\d+[^)]*)\)/)
      const e = porId(ids[0])!
      if (explicitas.length) {
        e.series = explicitas.map((x) => ({ orden: Number(x[1]), cargaKg: num(x[2]), reps: Number(x[3]) }))
      } else if (paren) {
        e.series = [...paren[1].matchAll(/(\d+(?:[.,]\d+)?)x(\d+)/g)].map((x, i) => ({ orden: i + 1, cargaKg: num(x[1]), reps: Number(x[2]) }))
      } else if (/orden 1 a (\d+)/.test(oracion)) {
        e.series = sinteticas(e, Number(oracion.match(/orden 1 a (\d+)/)![1]))
      } else if (/completas?/.test(oracion)) {
        for (const id of ids) { const x = porId(id)!; x.series = sinteticas(x, x.sets) }
      }
      const hace = oracion.match(/hace (\d+) minutos?/)
      if (hace) ultimoTocado = { ejercicioId: e.id, minutosAtras: Number(hace[1]) }
    }
  }

  // Pantalla abierta.
  let pantalla: string | null = null
  const ruta = texto.match(/Ruta abierta: (p[a-e]\d|pantalla)\b/)
  if (ruta && ruta[1] !== 'pantalla') pantalla = ruta[1]
  const enPantalla = texto.match(/con la pantalla en (\w+)/)
  if (enPantalla) pantalla = enPantalla[1]

  // Semana anterior: «Historial de pc1 la semana pasada (M11): 4 series de 52,5 kg x 10.»
  const semanaAnterior: Record<string, SerieHecha[]> = {}
  const h = texto.match(/Historial de (\w+) la semana pasada[^:]*: (\d+) series de (\d+(?:,\d+)?) kg x (\d+)/)
  if (h) semanaAnterior[h[1]] = Array.from({ length: Number(h[2]) }, (_, i) => ({ orden: i + 1, cargaKg: num(h[3]), reps: Number(h[4]) }))

  const barra = texto.match(/Perfil:[^.]*?barra[^.]*?(\d+(?:,\d+)?) kg/)
  const venc = /vencido/.test(texto)
  const micro = texto.match(/[Mm]icrociclo activo (M(\d+))/)
  const cron = texto.match(/Cron[oó]metro local de la sesi[oó]n: (\d+) minutos/)
  const hidr = texto.match(/Hidratacion (?:de hoy|hoy|del dia): (\d+)(?: ml)?/)
  const chk = texto.match(/horasSueno=(\d+)/)

  const { ayer, pendiente } = comidasDeTexto(texto)
  const verComp = texto.match(/verComposicion=(true|false)/)

  return {
    ahora,
    microciclo: micro ? { id: micro[1], numero: Number(micro[2]), vencido: venc } : { id: 'M12', numero: 12, vencido: venc },
    sesionHoyId,
    sesiones,
    pantalla: { ejercicioId: pantalla },
    ultimoTocado,
    semanaAnterior,
    perfil: { pesoBarraKg: barra ? num(barra[1]) : null, ...(verComp ? { verComposicion: verComp[1] === 'true' } : {}) },
    ...(ayer.length ? { comidasAyer: ayer } : {}),
    ...(pendiente.length ? { comidaPendiente: pendiente } : {}),
    ...(chk ? { checkinHoy: { horasSueno: Number(chk[1]) } } : {}),
    ...(hidr ? { hidratacionHoyMl: Number(hidr[1]) } : {}),
    cronometroMin: cron ? Number(cron[1]) : null,
  }
}
