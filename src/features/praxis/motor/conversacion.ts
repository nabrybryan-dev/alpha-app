import { decidirTurno, pasoTrasProponer, resumenDeGuardado, type PasoTrasProponer } from '../../../domain/praxis/conversacion'
import { destinatarioDe, estadoDeLaEspera, ofertaDePregunta, type Destinatario } from '../../../domain/praxis/enEspera'
import { SIN_DATO, type QueFalto } from '../../../domain/praxis/plan/responder'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../../data/praxis/preguntasEnEspera'
import { Cab, compactar, enfocarControles, limpiarControles, montar, refrescar } from './cabecera'
import { chips } from './controles'
import { conexion, type ConexionPraxis } from './conexion'
import { $, h } from './dom'
import { guardar, leer, reducido, trato, tu } from './entorno'
import { decir, decirCorto, mostrarPersona } from './frase'
import { Onda } from './onda'
import { Penta } from './penta'
import { entrarQuieta, preguntarCuidado, renderSaltos } from './senales'
import { Cancelado, S, cancelar, emitir, esperaCon, vigilar } from './sesion'

/**
 * La conversación de Praxis CONECTADA: lo que la persona escribe, turno por turno.
 *
 * El orden lo decide el dominio (`decidirTurno`) y aquí solo se pinta:
 *   1. Seguridad: riesgo → la Quieta; ambiguo → la pregunta de cuidado; salud → texto fijo.
 *      Nada de eso sale del teléfono.
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

async function registrar(c: ConexionPraxis, frase: string, tok: number, ejercicioId?: string): Promise<void> {
  let p: PasoTrasProponer
  pensando(true)
  try { p = pasoTrasProponer(await c.proponer(frase, idMensaje(), ejercicioId ? { pantallaEjercicioId: ejercicioId } : undefined), trato()) } finally { if (tok === S.tok) pensando(false) }
  vigilar(tok)
  switch (p.paso) {
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
      await decir(p.texto, tok)
      return
    case 'salud':
    case 'fallo':
      await decir(p.texto, tok)
      montar(() => [pieFormulario(c)])
      return
  }
}

async function atender(c: ConexionPraxis, frase: string, tok: number, eleccion?: { ejercicioId: string; eco: string }): Promise<void> {
  limpiarControles()
  const turno = decidirTurno(frase, c.leer(), c.hoy, trato())
  if (turno.paso === 'nada') return
  // La seguridad va primero: estas dos salidas cancelan el turno (el bucle termina en su próximo vigilar).
  if (turno.paso === 'quieta') { mostrarPersona(frase, 'texto'); entrarQuieta(turno.linea, frase, false); return }
  if (turno.paso === 'cuidado') { preguntarCuidado(frase, 'texto'); return }
  mostrarPersona(eleccion ? eleccion.eco : frase, 'texto')
  if (turno.paso === 'salud') { await decir(turno.texto, tok); montar(() => [pieFormulario(c)]); return }
  if (turno.paso === 'plan') {
    const r = turno.respuesta
    if (r.ofrecePregunta) { await ofrecerPregunta(c, frase, r.texto, r.queFalto ?? 'sin_dato', r.citas, tok); return }
    await decir(r.texto, tok)
    if (r.citas.length) montar(() => [citasNodo(r.citas)])
    return
  }
  await registrar(c, frase, tok, eleccion?.ejercicioId)
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
