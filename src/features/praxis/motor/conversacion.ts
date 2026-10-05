import { decidirTurno, pasoTrasProponer, resumenDeGuardado, type PasoTrasProponer } from '../../../domain/praxis/conversacion'
import { gravedad, permisoCubreLaRelectura } from '../../../domain/praxis/masGrave'
import { cabeCharla, limpiarTurnos, sinSaludoRepetido, type TurnoPrevio } from '../../../domain/praxis/charla/modelo'
import { destinatarioDe, estadoDeLaEspera, ofertaDePregunta, type Destinatario } from '../../../domain/praxis/enEspera'
import { SIN_DATO, type QueFalto } from '../../../domain/praxis/plan/responder'
import type { RespuestaDelRegistrador } from '../../../domain/praxis/conversacion'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../../data/praxis/preguntasEnEspera'
import { Cab, compactar, enfocarControles, limpiarControles, montar, refrescar } from './cabecera'
import { charlaSuelta, decidirTurnoConCharla, pareceCharla, type CharlaConModelo } from './charla'
import { chips } from './controles'
import { conexion, type ConexionPraxis } from './conexion'
import { $, h } from './dom'
import { guardar, leer, reducido, trato, tu } from './entorno'
import { decir, decirCorto, mostrarPersona } from './frase'
import { Onda } from './onda'
import { Penta } from './penta'
import { entrarQuieta, preguntarCuidado, renderSaltos } from './senales'
import { Cancelado, Dia, S, cancelar, emitir, esperaCon, vigilar } from './sesion'

/**
 * La conversación de Praxis CONECTADA: lo que la persona escribe, turno por turno.
 *
 * El orden lo decide el dominio (`decidirTurno`) y aquí solo se pinta:
 *   1. Seguridad: riesgo → la Quieta; ambiguo → la pregunta de cuidado; salud → texto fijo.
 *      Nada de eso entra al hilo ni se guarda. Solo con el interruptor de consentimiento de `masGrave.ts` encendido
 *      (hoy apagado), cuidado y salud se releen también con el modelo y la pantalla sube si lee algo más grave
 *      (`subirSiHaceFalta`); sin él, nada de eso sale del teléfono.
 *   1b. Solo si el filtro no marcó nada: la charla. «Gracias», «quién eres», «chao» se contestan aquí mismo
 *      (`charla.ts`). Los saludos, el «¿cómo estás?» y lo que el plan no puede contestar van al modelo (la
 *      misma llamada del registrador), con una APERTURA corta que Praxis dice al instante mientras piensa.
 *      Si el modelo tarda o falla, cae al libreto local: nunca un silencio y nunca un «no te entendí».
 *      La charla es solo texto: no guarda nada y no crea tarjetas.
 *   2. Una pregunta por el plan se contesta con lo que Praxis ve (lista blanca), sin modelo.
 *   3. Lo demás va al registrador (Edge Function `praxis-registro`): vuelve una PROPUESTA,
 *      se enseña en una tarjeta y se guarda solo si la persona toca «Guardar».
 *   4. Cuando Praxis no sabe: «¿Se lo pregunto a tu coach?», y solo con el «sí» deja la
 *      pregunta en espera.
 *
 * Praxis no cambia cargas ni el plan: no hay aquí ninguna llamada que escriba un microciclo.
 */
const DESCARTAR = '__descartar__'
let nMensaje = 0
function idMensaje(): string {
  try { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID() } catch { /* sigue */ }
  return `m-${Date.now()}-${++nMensaje}`
}

function pensando(si: boolean): void {
  const dicho = $('#dicho')
  if (si) { Onda.estado('piensa'); dicho.setAttribute('aria-busy', 'true'); $('#srPiensa').textContent = 'Praxis está pensando'; if (reducido()) $('#ayuda').textContent = 'Pensando…' }
  else { if (Onda.estadoActual === 'piensa') Onda.estado('reposo'); dicho.removeAttribute('aria-busy'); $('#srPiensa').textContent = ''; if ($('#ayuda').textContent === 'Pensando…') $('#ayuda').textContent = '' }
}

const rolDe = (d: Destinatario): string => tu('tu ', 'su ') + (d === 'nutricionista' ? 'nutricionista' : 'coach')

function pieFormulario(c: ConexionPraxis): HTMLElement | null {
  const ir = c.irAlFormulario
  if (!ir) return null
  return h('div', { class: 'pie-controles', 'data-k': 'formulario' }, h('button', { type: 'button', class: 'seguir', onclick: () => ir() }, 'Abrir el formulario'))
}

/** Las referencias de lo citado: la persona puede comprobar que Praxis no inventó. */
function citasNodo(citas: string[]): HTMLElement {
  return h('div', { class: 'tarjeta-registro', 'data-k': 'citas' }, h('span', { class: 'marca-ejemplo' }, tu('De tu plan', 'De su plan')), citas.map((c) => h('p', { class: 'salto' }, c)))
}

/* ——— La tarjeta de confirmación: nada se guarda hasta el toque ——— */
type Confirmar = Extract<PasoTrasProponer, { paso: 'confirmar' }>

function mostrarTarjeta(c: ConexionPraxis, p: Confirmar): void {
  const estado = { ocupado: false }
  const alGuardar = async (): Promise<void> => {
    if (estado.ocupado) return // un toque: el segundo no manda otra vez
    estado.ocupado = true; refrescar()
    const tok = S.tok
    pensando(true)
    const r = await c.guardar({ mensajeId: p.mensajeId, registros: p.propuesta.registros, confirmaSesion: p.tarjeta.requiereConfirmarSesion })
    if (tok !== S.tok || S.quieta || $('#sala').hidden) return
    pensando(false)
    const res = resumenDeGuardado(r, trato())
    decirCorto(res.todoGuardado ? 'Listo, guardado.' : tu('No todo quedó guardado. Mira el detalle.', 'No todo quedó guardado. Mire el detalle.'))
    montar(() => [h('div', { class: 'tarjeta-registro', 'data-k': 'resultado' },
      h('span', { class: 'marca-ejemplo' }, 'Lo que pasó al guardar'),
      res.lineas.map((l) => h('p', { class: 'salto' }, l)),
      !res.todoGuardado && pieFormulario(c))])
  }
  const alDescartar = (): void => {
    if (estado.ocupado) return
    limpiarControles(); decirCorto('Listo, no guardé nada.')
  }
  const botonGuardar = p.tarjeta.botones.find((b) => b.id === 'guardar')
  montar(() => [h('div', { class: 'tarjeta-registro', 'data-k': 'tarjeta' },
    h('span', { class: 'marca-ejemplo' }, tu('Lo que entendí · nada se guarda hasta que toques Guardar', 'Lo que entendí · nada se guarda hasta que toque Guardar')),
    p.tarjeta.titulo && h('strong', { class: 'tarjeta-titulo' }, p.tarjeta.titulo),
    h('ul', { class: 'tarjeta-lineas' }, p.tarjeta.lineas.map((l) => h('li', null, l.texto, l.detalle && h('small', null, l.detalle), l.origen && h('small', null, l.origen)))),
    p.tarjeta.avisos.map((a) => h('p', { class: 'salto' }, a)),
    p.tarjeta.descartado.length > 0 && h('p', { class: 'pie-nota' }, 'No guardo: ' + p.tarjeta.descartado.join(' · ')),
    h('div', { class: 'pie-controles' },
      h('button', { type: 'button', class: 'chip', 'data-k': 'descartar', disabled: estado.ocupado, onclick: alDescartar }, 'Descartar'),
      h('button', { type: 'button', class: 'btn-plata', 'data-k': 'guardar', disabled: estado.ocupado, onclick: () => void alGuardar() }, estado.ocupado ? 'Guardando…' : botonGuardar?.texto || 'Guardar')))])
  enfocarControles()
}

/* ——— «Pregunta en espera»: sin el «sí» no se manda nada ——— */
function textoTrasPreguntar(r: ResultadoDejarPregunta, dest: Destinatario): string {
  if (r.ok) return tu(`Listo, le dejé tu pregunta a ${rolDe(r.destinatario)}. Te aviso aquí cuando responda.`, `Listo, le dejé su pregunta a ${rolDe(r.destinatario)}. Le aviso aquí cuando responda.`)
  switch (r.motivo) {
    case 'no_disponible':
      return tu(`Todavía no puedo dejarle la pregunta a ${rolDe(dest)}: esa parte aún no está encendida. No la mandé. Escríbele por el chat de la app.`, `Todavía no puedo dejarle la pregunta a ${rolDe(dest)}: esa parte aún no está encendida. No la mandé. Escríbale por el chat de la app.`)
    case 'tope':
      return tu('Ya tienes dos preguntas en espera. No mandé esta; cuando te respondan una, puedo dejar otra.', 'Ya tiene dos preguntas en espera. No mandé esta; cuando le respondan una, puedo dejar otra.')
    case 'riesgo':
      return tu('Eso no lo mando como una pregunta. Si es urgente, llama al 123.', 'Eso no lo mando como una pregunta. Si es urgente, llame al 123.')
    default:
      return tu('No pude dejar la pregunta, así que no la mandé. Inténtalo más tarde o escríbele por el chat de la app.', 'No pude dejar la pregunta, así que no la mandé. Inténtelo más tarde o escríbale por el chat de la app.')
  }
}

async function ofrecerPregunta(c: ConexionPraxis, frase: string, texto: string, queFalto: QueFalto, citas: string[], tok: number): Promise<void> {
  const dest = destinatarioDe(frase)
  await decir(`${texto} ${ofertaDePregunta(dest, trato())}`, tok)
  const estado = { ocupado: false }
  const alElegir = async (v: string): Promise<void> => {
    if (estado.ocupado) return
    estado.ocupado = true
    limpiarControles()
    if (v !== 'si') { decirCorto('Listo, no la mando.'); return }
    const t0 = S.tok
    pensando(true)
    const r = await c.preguntar({ frase, queFalto, citas })
    if (t0 !== S.tok || S.quieta || $('#sala').hidden) return
    pensando(false)
    decirCorto(textoTrasPreguntar(r, dest))
  }
  montar(() => [
    citas.length > 0 && citasNodo(citas),
    h('div', { class: 'grupo', 'data-k': 'oferta' }, chips<string>([[tu('Sí, pregúntale', 'Sí, pregúntele'), 'si'], ['No, gracias', 'no']], (v) => void alElegir(v), null, 'oferta')),
  ])
  enfocarControles()
}

/* ——— Lo que va al registrador ——— */
const plano = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Si la opción que tocó la persona es el nombre de un ejercicio de su plan activo, su id.
 * Antes, al tocar «Sentadilla goblet…», se mandaba «frase. opción» y el modelo volvía a citar
 * «sentadilla» a secas: el registrador preguntaba lo mismo otra vez (Bryan, 2-oct).
 */
function ejercicioDeLaOpcion(c: ConexionPraxis, opcion: string): string | null {
  const plan = c.leer().activo
  if (!plan) return null
  const buscado = plano(opcion)
  for (const s of plan.sesiones) for (const e of s.ejercicios) if (plano(e.nombre) === buscado) return e.id
  return null
}

/* ——— La charla con modelo ——— */

/**
 * Lo dicho en ESTA sesión, para que el modelo charle con hilo. Vive en memoria: se vacía al abrir la sala,
 * no se escribe en el almacenamiento ni en la base. Al servidor viajan, como mucho, los últimos 6.
 */
let historial: TurnoPrevio[] = []
const anotar = (rol: TurnoPrevio['rol'], texto: string): void => { historial = [...historial, { rol, texto }].slice(-12) }

/** Cuánto se espera al modelo en un turno de charla antes de caer al libreto local. Las pruebas lo bajan. */
export const limitesDeCharla = { esperaMs: 7000 }

/** Lo que `registrar` sabe de la charla de este turno. */
interface TurnoDeCharla {
  /** Los turnos de antes de esta frase (ya saneados, máximo 6). */
  previos: TurnoPrevio[]
  /** El saludo adelantado: se dice YA, mientras el modelo piensa. */
  apertura: string | null
  /** Si el modelo falla: lo que sigue a la apertura (o la respuesta entera). `null`: no hay libreto para esta frase. */
  alFallar: string | null
  plan: CharlaConModelo['plan']
  abreAnimo: boolean
  /** ¿Esta frase se espera como charla (y por eso lleva tiempo máximo y libreto de respaldo)? */
  esCharla: boolean
}

function conLimite<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((res) => {
    const t = setTimeout(() => res(null), ms)
    p.then((v) => { clearTimeout(t); res(v) }, () => { clearTimeout(t); res(null) })
  })
}

async function dijo(texto: string, tok: number): Promise<void> {
  anotar('praxis', texto)
  await decir(texto, tok)
}

/** El modelo no contestó (red, sesión, tiempo, 502): el libreto local en vez de un silencio o un «no te entendí». ¿Quedó atendido? */
async function alFallarLaCharla(c: ConexionPraxis, frase: string, tok: number, ch: TurnoDeCharla): Promise<boolean> {
  if (ch.alFallar !== null) { animoPendiente = ch.abreAnimo; await dijo(ch.alFallar, tok); return true }
  if (ch.plan) {
    const r = ch.plan.respuesta
    if (r.ofrecePregunta) await ofrecerPregunta(c, frase, r.texto, r.queFalto ?? 'sin_dato', r.citas, tok)
    else await dijo(r.texto, tok)
    return true
  }
  if (ch.esCharla) { await dijo(charlaSuelta(trato()), tok); return true }
  return false
}

async function registrar(c: ConexionPraxis, frase: string, tok: number, ejercicioId: string | undefined, ch: TurnoDeCharla): Promise<void> {
  let r: RespuestaDelRegistrador | null
  pensando(true)
  try {
    const pedido = c.proponer(frase, idMensaje(), {
      ...(ejercicioId ? { pantallaEjercicioId: ejercicioId } : {}),
      charla: { trato: trato(), nombre: c.nombre ?? null, turnos: ch.previos, apertura: ch.apertura },
    })
    const esperado = ch.esCharla ? conLimite(pedido, limitesDeCharla.esperaMs) : pedido
    if (ch.apertura) { // la entrada corta sale ya; el modelo sigue pensando
      await dijo(ch.apertura, tok)
      if (tok === S.tok) pensando(true)
    }
    r = await esperado
  } finally { if (tok === S.tok) pensando(false) }
  vigilar(tok)
  if ((r === null || !r.ok) && (await alFallarLaCharla(c, frase, tok, ch))) return
  // Sin nada que guardar y sin respuesta del modelo: el libreto, no el mensaje genérico.
  if (r && r.ok && !r.charla && ch.alFallar !== null && cabeCharla(r.propuesta)) { await alFallarLaCharla(c, frase, tok, ch); return }
  const p: PasoTrasProponer = pasoTrasProponer(r ?? { ok: false, motivo: 'red' }, trato())
  switch (p.paso) {
    case 'charla': {
      // Si Praxis ya saludó en voz alta, un saludo repetido por el modelo se quita (defensa en profundidad: el servidor ya lo quita).
      const texto = ch.apertura ? (sinSaludoRepetido(p.texto, c.nombre ?? null) || p.texto) : p.texto
      animoPendiente = ch.abreAnimo && /\?\s*$/.test(texto)
      await dijo(texto, tok)
      return
    }
    case 'confirmar':
      await decir('Esto entendí. ¿Lo guardo?', tok)
      mostrarTarjeta(c, p)
      return
    case 'aclarar': {
      await decir(p.texto, tok)
      const opciones = p.opciones
      montar(() => [h('div', { class: 'grupo', 'data-k': 'aclarar' }, chips<string>([...opciones.map((o): [string, string] => [o, o]), ['Descartar', DESCARTAR]], (v) => {
        limpiarControles()
        if (v === DESCARTAR) { decirCorto('Listo, no anoté nada.'); return }
        // Las dos vuelven a pasar por el filtro de riesgo, como cualquier frase.
        const id = ejercicioDeLaOpcion(c, v)
        if (id) emitir({ tipo: 'texto', txt: frase, fuente: 'toque', ejercicioId: id, eco: v }) // la frase de antes, con el ejercicio elegido
        else emitir({ tipo: 'texto', txt: `${frase}. ${v}`, fuente: 'toque' })
      }, null, 'aclarar'))])
      enfocarControles()
      return
    }
    case 'quieta':
      entrarQuieta(p.linea, frase, false)
      return
    case 'cuidado':
      preguntarCuidado(frase, 'texto')
      return
    case 'no_se':
      await ofrecerPregunta(c, frase, p.texto, p.queFalto, [], tok)
      return
    case 'dicho':
      await dijo(p.texto, tok)
      return
    case 'salud':
    case 'fallo':
      await decir(p.texto, tok)
      montar(() => [pieFormulario(c)])
      return
  }
}

/* Lo último que dijo Praxis: ¿fue una pregunta de ánimo? Y cuántas veces habló ya la persona en esta sesión. Solo sirven a la charla. */
let animoPendiente = false, turnosHablados = 0

/* ——— «Gana la lectura más grave» ———
   La respuesta del filtro (cuidado o salud) se muestra YA, sin esperar. En paralelo, y solo si el interruptor de consentimiento
   está encendido (`c.releerRiesgo` existe), el servidor la relee con el modelo. Si lo que vuelve es MÁS GRAVE, la pantalla sube:
     - Quieta: siempre, mientras la sala siga abierta, aunque la persona ya haya escrito otra cosa (una urgencia no caduca);
     - cuidado (desde salud): solo si ese sigue siendo el último turno, para no pisar una conversación que ya siguió.
   Si el modelo falla, tarda, no contesta o devuelve algo igual o menor, no pasa nada: ya se dijo lo del filtro. La frase NO entra al hilo. */
let turnoDeSeguridad = 0

function subirSiHaceFalta(c: ConexionPraxis, frase: string, filtro: 'cuidado' | 'salud'): void {
  const releer = c.releerRiesgo
  if (!releer) return
  if (!permisoCubreLaRelectura(Dia.permisos)) return // permiso de una versión vieja: la frase marcada NO sale del teléfono
  S.leidasPorModelo.push(frase)
  const miTurno = ++turnoDeSeguridad
  const actual = gravedad(filtro === 'salud' ? { tipo: 'salud', filtro: 'sintoma' } : { tipo: 'cuidado' })
  void releer(frase).then((m) => {
    if (!m || gravedad(m) <= actual) return
    if (conexion() !== c || $('#sala').hidden || S.quieta) return // la persona ya se fue de la sala, o ya está en la Quieta
    if (m.tipo === 'quieta') { entrarQuieta(m.linea, frase, false, true); return }
    if (m.tipo === 'cuidado' && miTurno === turnoDeSeguridad && !S.cuidado) preguntarCuidado(frase, 'texto', true)
  }, () => undefined)
}

async function atender(c: ConexionPraxis, frase: string, tok: number, eleccion?: { ejercicioId: string; eco: string }): Promise<void> {
  limpiarControles()
  const previos = limpiarTurnos(historial) // lo de ANTES de esta frase: máximo 6
  // Con un ejercicio elegido con un toque nunca es charla. Si no: el filtro de riesgo primero y, solo si no marca nada, la charla.
  const turno = eleccion
    ? decidirTurno(frase, c.leer(), c.hoy, trato())
    : decidirTurnoConCharla(frase, c.leer(), c.hoy, { trato: trato(), hora: new Date().getHours(), esperaAnimo: animoPendiente, yaHablo: turnosHablados > 0, nombre: c.nombre ?? null })
  if (turno.paso === 'nada') return
  turnosHablados++
  animoPendiente = false // lo último que dijo Praxis cambia con cada turno; solo el saludo y el «¿Y tú?» lo vuelven a abrir
  // La seguridad va primero: estas dos salidas cancelan el turno (el bucle termina en su próximo vigilar).
  if (turno.paso === 'quieta') { mostrarPersona(frase, 'texto'); entrarQuieta(turno.linea, frase, false); return }
  if (turno.paso === 'cuidado') { preguntarCuidado(frase, 'texto'); subirSiHaceFalta(c, frase, 'cuidado'); return }
  mostrarPersona(eleccion ? eleccion.eco : frase, 'texto')
  if (turno.paso === 'salud') { subirSiHaceFalta(c, frase, 'salud'); await decir(turno.texto, tok); montar(() => [pieFormulario(c)]); return }
  if (!eleccion) anotar('persona', frase) // ya pasó el filtro de riesgo; el saneador vuelve a descartar lo marcado
  if (turno.paso === 'charla') { // 0 ms, 0 tokens: nada va al servidor ni se guarda, y se dice con la misma voz que todo lo demás
    animoPendiente = turno.respuesta.esperaAnimo
    await dijo(turno.respuesta.texto, tok)
    return
  }
  if (turno.paso === 'plan') {
    const r = turno.respuesta
    if (r.ofrecePregunta) { await ofrecerPregunta(c, frase, r.texto, r.queFalto ?? 'sin_dato', r.citas, tok); return }
    await dijo(r.texto, tok)
    if (r.citas.length) montar(() => [citasNodo(r.citas)])
    return
  }
  if (turno.paso === 'charlaModelo') {
    await registrar(c, frase, tok, undefined, { previos, apertura: turno.apertura, alFallar: turno.alFallar, plan: turno.plan, abreAnimo: turno.abreAnimo, esCharla: true })
    return
  }
  await registrar(c, frase, tok, eleccion?.ejercicioId, { previos, apertura: null, alFallar: null, plan: null, abreAnimo: false, esCharla: !eleccion && pareceCharla(frase) })
}

/* ——— Las preguntas en espera: «te aviso cuando responda» se cumple al abrir la sala ——— */
function bandeja(nuevas: PreguntaConRespuesta[], abiertas: PreguntaConRespuesta[]): HTMLElement {
  return h('div', { class: 'tarjeta-registro', 'data-k': 'bandeja' },
    nuevas.map((p) => h('div', { class: 'reflejo' },
      h('span', { class: 'marca-ejemplo' }, 'Respondió ' + rolDe(p.destinatario)),
      h('p', { class: 'pie-nota' }, '«' + p.pregunta + '»'),
      h('p', null, p.respuesta || ''))),
    abiertas.map((p) => h('p', { class: 'salto' }, estadoDeLaEspera(p, new Date(), trato()))))
}

async function saludar(c: ConexionPraxis, tok: number): Promise<void> {
  const ve = c.leer()
  const partes = [tu('Hola. Cuéntame qué quieres anotar o pregúntame por tu plan.', 'Hola. Cuénteme qué quiere anotar o pregúnteme por su plan.')]
  if (ve.falta.includes('plan_activo')) partes.push(tu(`${SIN_DATO}: no veo un plan activo tuyo.`, `${SIN_DATO}: no veo un plan activo suyo.`))
  await decir(partes.join(' '), tok)
  const lista = await c.preguntas().catch((): PreguntaConRespuesta[] => [])
  vigilar(tok)
  if (S.montar || S.cola.length) return // la persona ya escribió: no se le pisa lo que está viendo
  const vistas = leer<string[]>('respuestasVistas', [])
  const nuevas = lista.filter((p) => p.estado === 'respondida' && !!p.respuesta && !vistas.includes(p.id))
  const abiertas = lista.filter((p) => p.estado === 'abierta')
  if (!nuevas.length && !abiertas.length) return
  montar(() => [bandeja(nuevas, abiertas)])
  if (nuevas.length) guardar('respuestasVistas', [...vistas, ...nuevas.map((p) => p.id)].slice(-50))
}

export async function correrConversacion(opt: { saludo?: boolean } = {}): Promise<void> {
  const c = conexion()
  if (!c) return
  cancelar()
  const tok = S.tok
  try {
    if (!S.t0) S.t0 = performance.now()
    S.turno = 'conversa'; S.enFirma = false; S.cola = []
    animoPendiente = false; turnosHablados = 0; historial = []
    Cab.pendiente = false // conectada no se compacta: el agujero se queda en el centro, que es por donde se habla (Bryan, 2-oct)
    Onda.soltarFirma(); Onda.estado('reposo')
    Penta.cerrar(); $('#penta').hidden = true; $('#muelle').hidden = false; $('#editor').hidden = true
    limpiarControles(); renderSaltos()
    if (opt.saludo !== false) { compactar(false); await saludar(c, tok) }
    for (;;) {
      const e = await esperaCon(tok, null)
      if (e.tipo !== 'texto' || !e.txt) continue
      await atender(c, e.txt, tok, e.ejercicioId ? { ejercicioId: e.ejercicioId, eco: e.eco ?? e.txt } : undefined)
    }
  } catch (e) { if (!(e instanceof Cancelado)) throw e }
}
