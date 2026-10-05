import { filtroDeRiesgo } from '../../../domain/praxis/riesgo'
import { ESCALA3, type Campo, type TipoRiesgo, type Valor } from './datos'
import { cap, normalizar } from './texto'

/**
 * Qué dijo la persona: un guion con reglas. Lo dudoso no se adivina: pasa a duda.
 *
 * ES DE EJEMPLO. En la app real esto lo hace el registrador (que no está desplegado), y la
 * seguridad no puede descansar solo en una lista de expresiones: la decisión firmada es
 * diccionario + modelo en cada mensaje, y gana el más protector.
 */
const NUMS: Record<string, number> = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 }
const MINS: Record<string, number> = { media: 30, cuarto: 15, diez: 10, cinco: 5, veinte: 20, quince: 15, cuarenta: 40 }
const NUM_RE = '(\\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)'
const MIN_RE = '(?:(?::|\\.| y )(\\d{1,2}|media|cuarto|diez|cinco|veinte|quince|cuarenta))?'
const aNum = (w: string): number | undefined => (/^\d+$/.test(w) ? +w : NUMS[w])
const aMin = (w: string | undefined): number => (w == null ? 0 : /^\d+$/.test(w) ? +w : MINS[w])

/**
 * Las señales de riesgo NO se deciden aquí: las decide `domain/praxis/riesgo.ts`, que es la
 * única lista (la de la escena y la del registrador, juntas; gana la más protectora). Aquí
 * solo queda la señal de comida, que acompaña sin apagar el día.
 */
const RIESGO_COMIDA = /vomit|me purg|purgarme|atracon|laxantes/

export interface CampoLeido { campo: Campo; valor: Valor; cita: string }
export interface DudaLeida { campo: Campo; opciones: string[]; cita: string }
export interface Interpretacion {
  campos: CampoLeido[]
  dudas: DudaLeida[]
  sobrante: string[]
  riesgo?: TipoRiesgo
  ambiguo?: boolean
  alimentaria?: boolean
  persona?: boolean
  noSe?: boolean
  hilo?: 'si' | 'no' | 'a_medias'
  nota?: boolean
}
type Hallazgo = RegExpExecArray & { cita: string }
type Regla = [RegExp, string | string[], string[]?]

export function interpretar(txt: string, turno: string | null): Interpretacion {
  const n = normalizar(txt)
  const rangos: [number, number][] = []
  const r: Interpretacion = { campos: [], dudas: [], sobrante: [] }
  const libre = (a: number, b: number) => !rangos.some(([x, y]) => x < b && y > a)
  /* Busca la primera coincidencia que no pise texto que otro campo ya usó */
  const buscar = (re: RegExp, grupoCita = 0): Hallazgo | null => {
    const g = new RegExp(re.source, re.flags.replace('g', '') + 'g')
    let m: RegExpExecArray | null
    for (;;) {
      m = g.exec(n)
      if (!m) return null
      if (m[0] === '') { g.lastIndex++; continue }
      if (libre(m.index, m.index + m[0].length)) break
    }
    const sub = m[grupoCita] || m[0], ini = m.index + m[0].indexOf(sub)
    rangos.push([m.index, m.index + m[0].length])
    return Object.assign(m, { cita: txt.substring(ini, ini + sub.length).trim() })
  }
  /* ¿Hay una negación en las 3 palabras anteriores, dentro de la misma frase? */
  const negado = (m: Hallazgo) => {
    const seg = n.slice(0, m.index).split(/[,.;!?]/).pop() || ''
    return seg.trim().split(/\s+/).filter(Boolean).slice(-3).some((t) => /^(no|nada|ni|nunca|tampoco|jamas)$/.test(t))
  }
  const poner = (campo: Campo, valor: Valor, cita: string) => r.campos.push({ campo, valor, cita })
  /* Una regla que se niega no se invierte a ciegas: pasa a duda con las otras opciones */
  const decidir = (campo: Campo, reglas: Regla[]) => {
    for (const [re, val, dudaNeg] of reglas) {
      const m = buscar(re)
      if (!m) continue
      if (Array.isArray(val)) { r.dudas.push({ campo, opciones: negado(m) && dudaNeg ? dudaNeg : val, cita: m.cita }); return true }
      if (negado(m) && ESCALA3[campo]) { r.dudas.push({ campo, opciones: ESCALA3[campo].filter((x) => x !== val), cita: m.cita }); return true }
      poner(campo, val, m.cita)
      return true
    }
    return false
  }
  const marca = filtroDeRiesgo(txt)
  if (marca?.tipo === 'quieta') { r.riesgo = marca.linea; return r }
  if (marca?.tipo === 'cuidado') { r.ambiguo = true; return r }
  if (RIESGO_COMIDA.test(n)) r.alimentaria = true
  if (/eres (una |un )?(persona|humana|humano|real|bot|robot)|hablo con alguien|hay alguien ahi/.test(n)) { r.persona = true; return r }
  if (/^\s*(no se|ni idea|no me acuerdo|no recuerdo)\s*[.!]?\s*$/.test(n)) { r.noSe = true; return r }
  if (turno === 'hilo') {
    if (buscar(/a medias|mas o menos|medio|casi/)) r.hilo = 'a_medias'
    else if (buscar(/^\s*no\b|no salio|no pude|no la hice|no lo hice|no cumpli|se me olvido/)) r.hilo = 'no'
    else if (buscar(/^\s*si\b|salio|la hice|lo hice|cumpli/)) r.hilo = 'si'
    return r
  }
  if (turno === 'nota') { if (buscar(/^\s*si\b/)) r.nota = true; else if (buscar(/^\s*no\b/)) r.nota = false; return r }
  let m: Hallazgo | null
  const enEntreno = ['entreno', 'firma', 'rapido'].includes(turno || '')
  const hablaEntreno = enEntreno || /entren|gimnas|gym|pierna|sesion|rutina|upper|\bleg\b|cardio/.test(n)
  const hayDolor = /duel|dolor|molest|adolorid|lastim|contractur/.test(n)
  const hora = (mm: Hallazgo, noche: boolean): string | null => {
    let hh = aNum(mm[2]); const mi = aMin(mm[3])
    if (hh == null) return null
    if (noche) { if (hh >= 6 && hh <= 11) hh += 12; else if (hh === 12) hh = 0 }
    return String(hh % 24).padStart(2, '0') + ':' + String(mi).padStart(2, '0')
  }
  if ((m = buscar(new RegExp('(?:me acoste|me dormi|me fui a (?:dormir|la cama)|me meti a la cama)[^,.;]*?((?:como |tipo |a eso de )?a las? ' + NUM_RE + MIN_RE + ')'), 1))) { const v = hora(m, true); if (v) poner('horaAcostarse', v, m.cita) }
  if ((m = buscar(new RegExp('(?:me levante|me desperte|amaneci|me pare)[^,.;]*?((?:como |tipo |a eso de )?a las? ' + NUM_RE + MIN_RE + ')'), 1))) { const v = hora(m, false); if (v) poner('horaLevantarse', v, m.cita) }
  /* «7 horas y media» y «siete y media horas» */
  if ((m = buscar(new RegExp('(?:unas |como |casi )?' + NUM_RE + '( y media|[.,]5)? horas( y media)?')))) { const v = (aNum(m[1]) ?? NaN) + (m[2] || m[3] ? 0.5 : 0); if (v <= 14) poner('horasSueno', v, m.cita) }
  decidir('calidadSueno', [
    [/dormi (muy )?bien|descanse bien|dormi delicioso|dormi rico|dormi como un bebe/, 'BUENA'],
    [/dormi (muy )?mal|dormi fatal|dormi pesimo|casi no dormi|no dormi\b(?! (?:muy )?(?:bien|mal|regular))/, 'MALA'],
    [/dormi (regular|normal|maso|mas o menos)/, 'REGULAR'],
    [/a saltos|a ratos|me desperte (varias|muchas|mucho)|entrecortad[ao]/, ['MALA', 'REGULAR']],
  ])
  decidir('cansancio', [
    [/muy cansad[ao]|agotad[ao]|reventad[ao]|molid[ao]|sin energia|mamad[ao]|rendid[ao]|trasnochad[ao]|enguayabad[ao]/, 'MUCHO'],
    [/(algo|un poco|medio) cansad[ao]/, 'REGULAR'],
    [/descansad[ao]|con energia|fresc[ao]|con pila/, 'POCO'],
    [/cansad[ao]/, ['REGULAR', 'MUCHO'], ['POCO', 'REGULAR']],
  ])
  if (enEntreno) { // el entreno solo se lee en su turno y con verbo: «hice pierna», nunca por «pierna» sola
    if ((m = buscar(/(?:hice|entrene|toque|me toco|fue dia de|dia de) (?:dia de )?(?:pierna|leg a)\b|\bleg a\b|^\s*pierna\s*[.!]?\s*$/))) poner('entreno', 'LEG A', m.cita)
    else if ((m = buscar(/\bdescanse\b|no entrene|dia de descanso|hoy descanso/))) poner('entreno', 'Descansé', m.cita)
    else if ((m = buscar(/(?:hice|entrene) ([a-z ]{3,24}?)(?=,|\.|;| y |$)/, 1))) poner('entreno', cap(m.cita), m.cita)
  }
  if (hablaEntreno) decidir('rendimiento', [
    [/(me fue|salio|rendi|estuvo) (muy )?bien|buen entreno/, 'BUENA'],
    [/(me fue|salio|rendi|estuvo) (muy )?mal|mal entreno/, 'MALA'],
    [/(me fue|salio|rendi|estuvo) (regular|normal|mas o menos|maso)/, 'REGULAR'],
  ])
  decidir('motivacion', [
    [/(pocas|sin|cero|no tengo|no me dan) ganas|desmotivad[ao]|desanimad[ao]/, 'POCO'],
    [/(muchas|full|todas las) ganas|motivad[ao]|con toda/, 'MUCHO'],
    [/(algo de|normales|mas o menos) ganas|ganas normales/, 'REGULAR'],
  ])
  /* El hambre va antes que el dolor: «hambre como 6 de 10» gasta el «6 de 10» */
  if ((m = buscar(/hambre (?:como |de |en |un |tipo )?(\d{1,2})(?: de (?:10|diez))?|(\d{1,2})(?: de (?:10|diez))? de hambre/))) { const v = +(m[1] || m[2]); if (v >= 1 && v <= 10) poner('hambreEscala', v, m.cita) }
  let cero = false
  if ((m = buscar(/nada me duele|no me duele nada|sin dolor|no me duele|nada duele|ningun dolor/))) { poner('dolor', 0, m.cita); cero = true }
  else if (turno === 'cuerpo' && (m = buscar(/^\s*(nada|no|ninguno|todo bien)\s*[.!]?\s*$/))) { poner('dolor', 0, m.cita); cero = true }
  if (!cero && (hayDolor || turno === 'cuerpo')) {
    m = buscar(/(?:la |el |mi )?(rodilla|hombro|lumbar|espalda baja|espalda|cadera|tobillo|codo|cuello|muneca|gemelo|isquio\w*|cuadricep\w*)( (izquierd[ao]|derech[ao]))?/)
    const corto = n.trim().split(/\s+/).length <= 4 && !/hice|entren|toco|rutina|dia de/.test(n)
    if (!m && (hayDolor || corto)) m = buscar(/(?:la |el |mi )?(pierna|muslo|pantorrilla|brazo|pie|mano|talon)( (izquierd[ao]|derech[ao]))?/)
    if (m) poner('dolorDonde', m.cita.toLowerCase().replace(/^(la|el|mi)\s+/, ''), m.cita)
  }
  if ((m = buscar(/dolor (?:de |en )?(\d{1,2})|duele (?:un |como un |como )?(\d{1,2})/))) { const v = +(m[1] || m[2]); if (v <= 10) poner('dolor', v, m.cita) }
  else if ((hayDolor || turno === 'cuerpo') && (m = buscar(/(\d{1,2}) de (?:10|diez)/))) { const v = +m[1]; if (v <= 10) poner('dolor', v, m.cita) }
  else if (turno === 'cuerpo' && (m = buscar(/^\s*(\d{1,2})\s*$/))) { const v = +m[1]; if (v <= 10) poner('dolor', v, m.cita) }
  decidir('alimentacion', [
    [/comi (muy )?bien|comida (estuvo )?bien|me alimente bien/, 'BUENA'],
    [/comi (muy )?mal|comi fatal|comi pesimo|comi chatarra/, 'MALA'],
    [/comi (regular|normal|mas o menos|maso)/, 'REGULAR'],
  ])
  decidir('estres', [
    [/estres (alto|a mil|full|mucho|altisimo|por las nubes)|mucho estres|muy estresad[ao]/, 'MUCHO'],
    [/estres (medio|normal|regular|moderado)|algo estresad[ao]/, 'REGULAR'],
    [/estres (bajo|poco|tranqui\w*)|poco estres|sin estres|tranquil[ao]|relajad[ao]/, 'POCO'],
    [/estresad[ao]/, ['REGULAR', 'MUCHO'], ['POCO', 'REGULAR']],
  ])
  if ((m = buscar(/(\d{1,3}(?:[.,]\d{3})+|\d{3,6}) pasos/))) poner('pasos', +m[1].replace(/[.,]/g, ''), m.cita)
  let ini = 0 // lo que no encaja en ningún campo va literal a comentarios
  ;(n + ',').split('').forEach((ch, i) => {
    if (!/[,.;]/.test(ch)) return
    const a = ini, b = i
    ini = i + 1
    if (rangos.some(([x, y]) => x < b && y > a)) return
    const frag = txt.slice(a, b).trim().replace(/^(y|pero|aunque)\s+/i, '')
    if (frag.split(/\s+/).length >= 3) r.sobrante.push(frag)
  })
  return r
}

/** Sí o no dicho con palabras, donde solo cabían toques. `null` si no se entiende. */
export function siNo(txt: string): boolean | null {
  const n = normalizar(txt).trim()
  if (/^(si|claro|dale|listo|ok|bueno|vamos|de una)\b/.test(n)) return true
  if (/^(no|ahora no|hoy no|saltar|paso|nada)\b/.test(n)) return false
  return null
}
