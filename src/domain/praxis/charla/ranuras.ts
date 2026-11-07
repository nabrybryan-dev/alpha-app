/**
 * ESCUCHAR Y ANOTAR (ranuras) de la charla de Praxis. PURO: sin React, sin red, sin base, sin estado de módulo
 * (cada llamada solo ve el historial que se le pasa: ningún dato de una persona puede aparecer en el resultado
 * de otra).
 *
 * Reglas (diseño 6-nov-2026, sección 4, y decisiones de Bryan):
 *  - Cada valor sale con su CITA literal y el número del turno donde se dijo. Sin cita literal, se descarta.
 *  - Lo clínico (dolor, lesión, medicación, embarazo, diagnóstico, riesgo...) se marca aparte, «al coach», y la
 *    ORACIÓN donde aparece no llena ninguna ranura. Se avisa UNA sola vez por charla.
 *  - Lo ya dicho no se vuelve a preguntar. Solo se pregunta lo que CAMBIA la respuesta, una cosa por turno, y
 *    con una pregunta abierta enlazada a lo último que dijo la persona, nunca un texto fijo.
 *  - Lo que corrige lo anterior queda DUDOSO hasta que la persona lo confirme.
 *  - Al final, un resumen con lo entendido y su cita para aprobar o corregir (espejo con sus propias palabras).
 *
 * Detrás de `RANURAS_EN_CHARLA` (apagada): con ella apagada nada de esto cambia ninguna salida existente.
 * No guarda nada en la base; la memoria entre días NO está aquí (pide tabla nueva, ver PIEZA-RANURAS.md).
 */
import { esSubcadenaLiteral } from '../registro/esquema.ts'
import { marcarSaludPorDiccionario } from '../ingreso/extraer.ts'
import { filtroDeRiesgo } from '../riesgo.ts'
import { CATALOGO, IDS_RANURA, RANURA, plegar, type DefRanura, type IdRanura, type ValorRanura } from './ranurasCatalogo.ts'

/** Apagada hasta que Bryan diga que sí. */
export const RANURAS_EN_CHARLA = false

export interface TurnoDeCharla {
  rol: 'persona' | 'praxis'
  texto: string
  /** Praxis ya avisó en este turno que lo clínico lo ve el coach. */
  aviso?: 'coach'
  /** Praxis hizo en este turno una pregunta de ranura. */
  preguntaDeRanura?: boolean
}

export interface Citado { valor: ValorRanura; cita: string; turno: number }
export interface RanuraLlena extends Citado { id: IdRanura }
export interface RanuraDudosa {
  id: IdRanura
  motivo: 'conflicto' | 'correccion' | 'retirada'
  candidatos: Citado[]
}
export interface MarcaAlCoach { tema: string; cita: string; turno: number; urgencia: 'alta' | null }

export interface EstadoRanuras {
  llenas: RanuraLlena[]
  dudosas: RanuraDudosa[]
  vacias: IdRanura[]
  alCoach: MarcaAlCoach[]
  /** Lo que dijo la persona en su ÚLTIMO turno (para enlazar la pregunta): ranuras no clínicas con su cita. */
  ultimoTurno: { turno: number; citas: { id: IdRanura; cita: string }[] }
}

export interface EtiquetaExterna { ranura: string; valor: ValorRanura; cita: string; turno?: number }
export interface DescarteEtiqueta { ranura: string; motivo: 'ranura_desconocida' | 'sin_cita' | 'cita_invalida' | 'cita_clinica' | 'valor_invalido' }

const CORRIGE = /\b(ya no|no,? (eran|era|son|es|fueron)|en realidad|mejor dicho|perdon,? (son|eran|es)|me equivoque|corrijo|no no)\b/
const SOLO_RETIRA = /\bya no\b/

interface Candidata { id: IdRanura; valor: ValorRanura; cita: string; turno: number; corrige: boolean; retira: boolean }

function oraciones(texto: string): string[] {
  return texto.split(/[.!?;\n]+|(?<![\p{L}])pero(?![\p{L}])/giu).map((s) => s.trim()).filter(Boolean)
}

function valorValido(def: DefRanura, v: ValorRanura): boolean {
  if (def.opciones && !def.opciones.includes(String(v))) return false
  if (def.rango) return typeof v === 'number' && v >= def.rango[0] && v <= def.rango[1]
  return true
}

/** Lo clínico de una oración (diccionario del ingreso + filtro de riesgo de la app). */
function clinicoDe(oracion: string): { tema: string; cita: string; urgencia: 'alta' | null } | null {
  const d = marcarSaludPorDiccionario(oracion)
  if (d.marcas.length > 0) return { tema: d.marcas[0].tema, cita: d.marcas[0].cita, urgencia: d.urgencia }
  const r = filtroDeRiesgo(oracion)
  if (r) return { tema: 'riesgo', cita: '', urgencia: 'alta' }
  return null
}

function candidatasDeOracion(oracion: string, turno: number): Candidata[] {
  const f = plegar(oracion)
  const corrige = CORRIGE.test(f)
  const retira = SOLO_RETIRA.test(f)
  const salida: Candidata[] = []
  for (const def of CATALOGO) {
    for (const forma of def.formas) {
      const m = f.match(new RegExp(forma.re.source, forma.re.flags.replace('g', '')))
      if (!m || m.index === undefined) continue
      const valor = forma.valor(m, f)
      if (valor === null || !valorValido(def, valor)) continue
      const cita = oracion.slice(m.index, m.index + m[0].length)
      if (!esSubcadenaLiteral(oracion, cita)) continue
      salida.push({ id: def.id, valor, cita, turno, corrige, retira })
      break
    }
  }
  return salida
}

/** Valida lo que un modelo etiquetó: sin cita literal en un turno de la persona, o dentro de lo clínico, se descarta. */
export function validarEtiquetas(
  historial: readonly TurnoDeCharla[], etiquetas: readonly EtiquetaExterna[],
): { aceptadas: (EtiquetaExterna & { id: IdRanura; turno: number })[]; descartadas: DescarteEtiqueta[] } {
  const aceptadas: (EtiquetaExterna & { id: IdRanura; turno: number })[] = []
  const descartadas: DescarteEtiqueta[] = []
  for (const e of etiquetas) {
    const def = RANURA.get(e.ranura as IdRanura)
    if (!def) { descartadas.push({ ranura: e.ranura, motivo: 'ranura_desconocida' }); continue }
    if (typeof e.cita !== 'string' || !e.cita.trim()) { descartadas.push({ ranura: e.ranura, motivo: 'sin_cita' }); continue }
    let turno = -1
    historial.forEach((t, i) => {
      if (turno === -1 && t.rol === 'persona' && esSubcadenaLiteral(t.texto, e.cita) && (e.turno === undefined || e.turno === i + 1)) turno = i + 1
    })
    if (turno === -1) { descartadas.push({ ranura: e.ranura, motivo: 'cita_invalida' }); continue }
    if (clinicoDe(e.cita) || oraciones(historial[turno - 1].texto).some((o) => esSubcadenaLiteral(o, e.cita) && clinicoDe(o))) {
      descartadas.push({ ranura: e.ranura, motivo: 'cita_clinica' }); continue
    }
    if (!valorValido(def, e.valor)) { descartadas.push({ ranura: e.ranura, motivo: 'valor_invalido' }); continue }
    aceptadas.push({ ...e, id: def.id, turno })
  }
  return { aceptadas, descartadas }
}

/** Dado el historial de la charla, qué ranuras están llenas (valor + cita + turno), cuáles dudosas y cuáles vacías. */
export function analizarHistorial(historial: readonly TurnoDeCharla[], etiquetas: readonly EtiquetaExterna[] = []): EstadoRanuras {
  const candidatas: Candidata[] = []
  const alCoach: MarcaAlCoach[] = []
  const temasVistos = new Set<string>()
  let ultimaPersona = 0
  historial.forEach((t, i) => {
    if (t.rol !== 'persona') return
    const turno = i + 1
    ultimaPersona = turno
    for (const o of oraciones(t.texto)) {
      const c = clinicoDe(o)
      if (c) {
        if (!temasVistos.has(c.tema)) {
          temasVistos.add(c.tema)
          alCoach.push({ tema: c.tema, cita: c.cita, turno, urgencia: c.urgencia })
        }
        continue // la oración clínica no llena nada
      }
      candidatas.push(...candidatasDeOracion(o, turno))
    }
  })
  for (const e of validarEtiquetas(historial, etiquetas).aceptadas) {
    candidatas.push({ id: e.id, valor: e.valor, cita: e.cita, turno: e.turno, corrige: false, retira: false })
  }
  candidatas.sort((a, b) => a.turno - b.turno)

  const llenas: RanuraLlena[] = []
  const dudosas: RanuraDudosa[] = []
  for (const id of IDS_RANURA) {
    const mias = candidatas.filter((c) => c.id === id)
    if (mias.length === 0) continue
    let actual = null as Citado | null
    let duda = null as RanuraDudosa | null
    for (const c of mias) {
      const nuevo: Citado = { valor: c.valor, cita: c.cita, turno: c.turno }
      if (c.retira && actual) {
        duda = { id, motivo: 'retirada', candidatos: [...(duda?.candidatos ?? [actual])] }
        continue
      }
      if (c.retira) continue
      if (!actual) { actual = nuevo; continue }
      if (actual.valor === c.valor) continue
      const previos: Citado[] = duda?.candidatos ?? [actual]
      const ya = previos.some((p) => p.valor === c.valor)
      duda = {
        id,
        motivo: c.corrige || duda?.motivo === 'correccion' ? 'correccion' : 'conflicto',
        candidatos: ya ? [...previos] : [...previos, nuevo],
      }
    }
    if (duda) dudosas.push(duda)
    else if (actual) llenas.push({ id, ...actual })
  }
  const ocupadas = new Set<IdRanura>([...llenas.map((l) => l.id), ...dudosas.map((d) => d.id)])
  return {
    llenas, dudosas, alCoach,
    vacias: IDS_RANURA.filter((id) => !ocupadas.has(id)),
    ultimoTurno: {
      turno: ultimaPersona,
      citas: candidatas.filter((c) => c.turno === ultimaPersona && !c.retira && llenas.some((l) => l.id === c.id)).map((c) => ({ id: c.id, cita: c.cita })),
    },
  }
}

/* ——— Qué falta que CAMBIA la respuesta ——— */

export type TemaRespuesta = 'plan_entrenamiento' | 'progresion_carga' | 'nutricion' | 'recuperacion' | 'horarios' | 'motivacion'
type Objetivo = 'salud' | 'rendimiento' | 'estetica'

/** Por tema: las ranuras que cambian lo que Praxis responde, en orden de importancia. `siObjetivo`: solo si el objetivo ya dicho es uno de estos. */
export const CAMBIAN_LA_RESPUESTA: Record<TemaRespuesta, readonly { ranura: IdRanura; siObjetivo?: readonly Objetivo[] }[]> = {
  plan_entrenamiento: [
    { ranura: 'objetivo' }, { ranura: 'dias_semana' }, { ranura: 'tiempo_disponible' },
    { ranura: 'nivel', siObjetivo: ['rendimiento', 'estetica'] }, { ranura: 'tiempo_entrenando', siObjetivo: ['rendimiento', 'estetica'] },
  ],
  progresion_carga: [{ ranura: 'objetivo' }, { ranura: 'nivel', siObjetivo: ['rendimiento', 'estetica'] }, { ranura: 'tiempo_entrenando', siObjetivo: ['rendimiento', 'estetica'] }],
  nutricion: [
    { ranura: 'objetivo' }, { ranura: 'comida' }, { ranura: 'comida_entreno' }, { ranura: 'horario_entreno' },
    { ranura: 'actividad_diaria', siObjetivo: ['salud', 'estetica'] },
  ],
  recuperacion: [{ ranura: 'sueno_horas' }, { ranura: 'hora_acostarse' }, { ranura: 'estres' }],
  horarios: [{ ranura: 'horario_entreno' }, { ranura: 'trabajo' }, { ranura: 'tiempo_disponible' }, { ranura: 'dias_semana' }],
  motivacion: [{ ranura: 'objetivo' }, { ranura: 'estres' }],
}

export interface Faltante { ranura: IdRanura; motivo: 'vacia' | 'dudosa' }

/**
 * Qué falta que cambie la respuesta de este tema. NO devuelve lo que ya está lleno, ni lo que el objetivo hace
 * irrelevante, ni lo que otra ranura llena sustituye. Una ranura dudosa vuelve como pregunta de confirmación.
 */
export function queFaltaQueCambia(tema: TemaRespuesta, estado: EstadoRanuras): Faltante[] {
  const objetivo = estado.llenas.find((l) => l.id === 'objetivo')?.valor as Objetivo | undefined
  const llenas = new Set(estado.llenas.map((l) => l.id))
  const dudosas = new Set(estado.dudosas.map((d) => d.id))
  const salida: Faltante[] = []
  for (const r of CAMBIAN_LA_RESPUESTA[tema]) {
    if (r.siObjetivo && (!objetivo || !r.siObjetivo.includes(objetivo))) continue
    if (llenas.has(r.ranura)) continue
    const def = RANURA.get(r.ranura)
    if (def?.sustituidaPor?.some((s) => llenas.has(s))) continue
    salida.push({ ranura: r.ranura, motivo: dudosas.has(r.ranura) ? 'dudosa' : 'vacia' })
  }
  // Lo que corrige lo anterior se confirma ANTES de pedir datos nuevos.
  return [...salida.filter((f) => f.motivo === 'dudosa'), ...salida.filter((f) => f.motivo === 'vacia')]
}

/* ——— La pregunta: abierta, enlazada y sin fórmulas ——— */

/** Fórmulas prohibidas por Bryan (6-nov): sonar a guion para volver al cuestionario. Las pruebas las buscan en TODAS las salidas. */
export const FORMULAS_PROHIBIDAS: readonly RegExp[] = [
  /volviendo a/i, /volvamos a/i, /retomando/i, /regresando a/i, /como te (decia|dije)/i, /a lo que ib(a|amos)/i, /sigamos con tu evaluaci/i,
]

const ENLACES = ['Eso de «{c}» me deja pensando:', 'Sobre «{c}»,', 'Ya que mencionas «{c}»,', 'Con lo de «{c}» en mente,']
const PUENTES = ['Por cierto,', 'Una curiosidad:', 'Y ya que estamos,', '']

export interface ContextoPregunta {
  apuro?: boolean
  emocionBaja?: boolean
  historial?: readonly TurnoDeCharla[]
}

export interface PreguntaDeRanura { ranura: IdRanura; pregunta: string; confirmar: boolean }

const sinInterrogacion = (s: string) => s.replace(/[¿?]/g, '').trim()
const corta = (c: string) => (c.length > 60 ? `${c.slice(0, 57)}...` : c)

/**
 * La siguiente pregunta, o `null`. Solo si (1) falta algo, (2) cambia la respuesta de este tema, y (3) no hay
 * apuro, ni ánimo bajo, ni se hizo una pregunta de ranura en los 2 turnos anteriores de Praxis. UNA por turno.
 * La forma sale enlazada a lo último que dijo la persona y cambia según lo ya dicho por Praxis en la charla.
 */
export function siguientePregunta(tema: TemaRespuesta, estado: EstadoRanuras, ctx: ContextoPregunta = {}): PreguntaDeRanura | null {
  if (ctx.apuro || ctx.emocionBaja) return null
  const hist = ctx.historial ?? []
  const praxis = hist.filter((t) => t.rol === 'praxis')
  if (praxis.slice(-2).some((t) => t.preguntaDeRanura)) return null
  const falta = queFaltaQueCambia(tema, estado)[0]
  if (!falta) return null
  const def = RANURA.get(falta.ranura) as DefRanura
  const dicho = praxis.map((t) => plegar(t.texto)).join('\n')
  const n = praxis.length

  if (falta.motivo === 'dudosa') {
    const d = estado.dudosas.find((x) => x.id === falta.ranura) as RanuraDudosa
    const a = d.candidatos[0]
    const b = d.candidatos[d.candidatos.length - 1]
    const pregunta = d.motivo === 'retirada'
      ? `Entendí que ya no es así: «${corta(a.cita)}», ¿lo dejo sin dato?`
      : `Para no enredarme: antes dijiste «${corta(a.cita)}» y ahora «${corta(b.cita)}», ¿con cuál me quedo?`
    return { ranura: falta.ranura, pregunta, confirmar: true }
  }

  const libres = def.preguntas.filter((p) => !dicho.includes(plegar(sinInterrogacion(p))))
  const lista = libres.length ? libres : def.preguntas
  const cuerpo = sinInterrogacion(lista[n % lista.length])
  const ancla = estado.ultimoTurno.citas.find((c) => c.id !== falta.ranura)
  const inicio = ancla ? ENLACES[n % ENLACES.length].replace('{c}', corta(ancla.cita)) : PUENTES[n % PUENTES.length]
  const pregunta = inicio ? `${inicio} ¿${cuerpo}?` : `¿${cuerpo.charAt(0).toLocaleUpperCase('es')}${cuerpo.slice(1)}?`
  return { ranura: falta.ranura, pregunta, confirmar: false }
}

/* ——— Lo clínico: UN solo aviso por charla ——— */

/** ¿Hay que decirle ahora a la persona que lo clínico lo ve el coach? Solo si hay algo y Praxis no lo dijo ya en esta charla. */
export function debeAvisarAlCoach(estado: EstadoRanuras, historial: readonly TurnoDeCharla[]): boolean {
  return estado.alCoach.length > 0 && !historial.some((t) => t.rol === 'praxis' && t.aviso === 'coach')
}

/* ——— El resumen del final ——— */

export interface LineaResumen {
  id: IdRanura; etiqueta: string; texto: string; espejo: string; cita: string; turno: number
  estado: 'entendido' | 'por_confirmar'
  otrosCandidatos?: { cita: string; turno: number }[]
}
export interface ResumenFinal {
  lineas: LineaResumen[]
  alCoach: { tema: string; cita: string; turno: number }[]
  texto: string
  vacio: boolean
}

/**
 * «Lo entendido» con su cita, para aprobar o corregir. Espejo: repite las palabras de la persona. Lo dudoso va
 * marcado «por confirmar». Lo clínico va aparte, al coach, con SOLO la palabra que lo disparó.
 * `voz`: «tu» habla con la persona; «equipo» redacta en tercera persona para el coach.
 */
export function armarResumen(estado: EstadoRanuras, voz: 'tu' | 'equipo' = 'tu'): ResumenFinal {
  const lineas: LineaResumen[] = []
  for (const l of estado.llenas) {
    const d = RANURA.get(l.id) as DefRanura
    lineas.push({ id: l.id, etiqueta: d.etiqueta, texto: d.texto(l.valor), espejo: voz === 'tu' ? d.espejo(l.valor) : d.espejoEquipo(l.valor), cita: l.cita, turno: l.turno, estado: 'entendido' })
  }
  for (const du of estado.dudosas) {
    const d = RANURA.get(du.id) as DefRanura
    const ult = du.candidatos[du.candidatos.length - 1]
    lineas.push({
      id: du.id, etiqueta: d.etiqueta, texto: d.texto(ult.valor), espejo: voz === 'tu' ? d.espejo(ult.valor) : d.espejoEquipo(ult.valor),
      cita: ult.cita, turno: ult.turno, estado: 'por_confirmar', otrosCandidatos: du.candidatos.slice(0, -1).map((c) => ({ cita: c.cita, turno: c.turno })),
    })
  }
  lineas.sort((a, b) => IDS_RANURA.indexOf(a.id) - IDS_RANURA.indexOf(b.id))
  const alCoach = estado.alCoach.map((m) => ({ tema: m.tema, cita: m.cita, turno: m.turno }))

  const partes: string[] = []
  if (lineas.length) {
    partes.push(voz === 'tu' ? 'Esto fue lo que entendí:' : 'Entendido de la charla:')
    for (const l of lineas) {
      const base = voz === 'tu' ? `- Entendí que ${l.espejo}` : `- ${l.etiqueta}: ${l.texto}`
      const otro = l.otrosCandidatos?.length ? ` y antes «${l.otrosCandidatos[0].cita}»` : ''
      partes.push(l.estado === 'entendido' ? `${base} (dijiste «${l.cita}»).` : `${base} (por confirmar: dijiste «${l.cita}»${otro}).`)
    }
    partes.push(voz === 'tu' ? 'Si algo no es así, corrígelo; si está bien, apruébalo.' : 'Pendiente de aprobación de la persona.')
  }
  if (alCoach.length) {
    const temas = [...new Set(alCoach.map((a) => a.tema))].join(', ')
    partes.push(voz === 'tu' ? `Lo de salud no lo anoto yo: lo ve tu coach (${temas}).` : `Al coach (no se llenó ninguna ranura con esto): ${temas}.`)
  }
  return { lineas, alCoach, texto: partes.join('\n'), vacio: lineas.length === 0 && alCoach.length === 0 }
}

/* ——— Conexión detrás de la bandera ——— */

/** Con la bandera apagada devuelve `null`: nadie debe tocar nada. */
export function analizarCharla(historial: readonly TurnoDeCharla[], bandera: boolean = RANURAS_EN_CHARLA): EstadoRanuras | null {
  return bandera ? analizarHistorial(historial) : null
}

/**
 * El pedazo del contexto del modelo con lo que la persona YA dijo (para no repreguntarlo). Cadena vacía con la
 * bandera apagada o si no hay nada: así `armarContextoCharla` queda idéntico mientras esté apagada.
 */
export function bloqueRanurasParaPrompt(turnos: readonly { rol: 'persona' | 'praxis'; texto: string }[], bandera: boolean = RANURAS_EN_CHARLA): string {
  const e = analizarCharla(turnos, bandera)
  if (!e || (e.llenas.length === 0 && e.alCoach.length === 0)) return ''
  const lineas = e.llenas.map((l) => `- ${RANURA.get(l.id)?.etiqueta}: ${RANURA.get(l.id)?.texto(l.valor)}`)
  const aviso = e.alCoach.length ? ['- La persona mencionó algo de salud: ya va al coach; NO lo repitas ni lo interpretes.'] : []
  return ['YA DICHO por la persona en esta charla (no lo vuelvas a preguntar):', ...lineas, ...aviso].join('\n')
}
