import { Cab, alInicio, compactar, enfocarControles, limpiarControles, montar, soltarFlip, soltarSalidaControles } from './cabecera'
import { chips } from './controles'
import { conectada } from './conexion'
import { correrConversacion } from './conversacion'
import { LIN_QUIETA, type TipoRiesgo } from './datos'
import { $, aviso, copiar, h } from './dom'
import { tu } from './entorno'
import { decirCorto, fijarFrase, mostrarPersona, ponerSugerencias } from './frase'
import { interpretar } from './interpretar'
import { clamp } from './movimiento'
import { Onda } from './onda'
import { Viajeras, anotar } from './penta'
import { cerrarMenuMas, cerrarSala } from './sala'
import { S, cancelar, cortarDecir, emitir, fijarHecho, guardarBorrador, hayDatos, hoyReal, type Fuente } from './sesion'
import { correrCheckin } from './turnos'
import { Voz } from './voz'

/* ——— Lo que Praxis se salta hoy ——— */
export function salto(txt: string): void { if (S.saltos.includes(txt)) return; S.saltos.push(txt); renderSaltos() }
export function renderSaltos(): void {
  const box = $('#saltosLista')
  box.textContent = ''
  S.saltos.forEach((t) => box.append(h('p', { class: 'salto' }, t)))
  $('#saltos').hidden = S.saltos.length === 0 || !!S.quieta || S.listo
  renderSenal()
}

/* ——— Señales: lo grave detiene (Quieta), lo ambiguo se pregunta, lo de comida se acompaña sin apagar el día ——— */
function registrarSenal(tipo: string, frase: string): void {
  S.senales = S.senales.filter((x) => x.tipo !== tipo).concat([{ tipo, frase }])
  renderSenal(); guardarBorrador()
}
function renderSenal(): void {
  const box = $('#senal')
  box.textContent = ''
  box.hidden = !S.senales.length || !!S.quieta || !!S.listo
  if (box.hidden) return
  box.append(h('p', null, 'Gracias por contármelo. Bryan y Manuela lo van a leer con cuidado.'),
    h('div', null, h('button', { type: 'button', class: 'chip', onclick: () => noEraEso() }, 'No era eso')))
}
function comentarioCon(frase: string): string { return S.datos.comentarios ? S.datos.comentarios + ' · ' + frase : frase }
function noEraEso(): void {
  const s = S.senales[0]
  S.senales = []; renderSenal()
  if (s && !(S.datos.comentarios || '').includes(s.frase)) anotar('comentarios', comentarioCon(s.frase), 'texto', s.frase)
  else guardarBorrador()
  aviso('Listo. La dejé solo como un comentario.')
}
/** Lo que no es Quieta ni pregunta: una señal de comida se acompaña sin apagar el día. */
export function anotarSenalAlimentaria(txt: string): void { registrarSenal('alimentaria', txt) }
/* Devuelve true si tomó el control (Quieta o pregunta): quien llama no debe guardar nada */
export function revisarRiesgo(txt: string, fuente: Fuente): boolean {
  if (!txt || S.listo || S.quieta) return false
  const r = interpretar(txt, null)
  if (r.riesgo) { mostrarPersona(txt, fuente || 'texto'); entrarQuieta(r.riesgo, txt, false); return true }
  if (r.ambiguo) { preguntarCuidado(txt, fuente || 'texto'); return true }
  if (r.alimentaria && !conectada()) registrarSenal('alimentaria', txt) // conectada, lo de salud lo atiende la conversación
  return false
}
/* Una pregunta directa, escrita por personas: preguntar por el daño no aumenta el riesgo */
export function preguntarCuidado(txt: string, fuente: Fuente): void {
  mostrarPersona(txt, fuente)
  cancelar(); Voz.callar(); Onda.estado('reposo')
  S.cuidado = { txt, fuente }
  limpiarControles(); $('#editor').hidden = true; compactar(false)
  fijarFrase(tu('Eso que escribiste me importa. ¿Estás pensando en hacerte daño?', 'Eso que escribió me importa. ¿Está pensando en hacerse daño?'))
  montar(() => h('div', { class: 'grupo' }, chips([['Sí', 'si'], ['No', 'no'], ['Prefiero no decir', 'pn']], (v) => resolverCuidado(v), null, 'cuidado')))
  enfocarControles()
}
function resolverCuidado(v: string): void {
  const c = S.cuidado
  if (!c) return
  S.cuidado = null
  if (v === 'si' || v === 'pn') { entrarQuieta('vida', c.txt, false); return }
  limpiarControles()
  if (conectada()) { // la frase no se anota ni viaja a ningún modelo: se queda aquí
    decirCorto('Gracias por decírmelo. Seguimos.')
    void correrConversacion({ saludo: false })
    return
  }
  anotar('comentarios', comentarioCon(c.txt), c.fuente, c.txt) // la frase le llega a Bryan
  decirCorto('Gracias por decírmelo. Seguimos.')
  void correrCheckin()
}

/* ——— Quieta: una señal de riesgo apaga todo lo lúdico. La seguridad va por delante de la coreografía: ninguna animación de salida,
   la cabecera se compacta al instante (los números quedan a la vista), el foco va al primer párrafo y el agujero y el cielo se apagan juntos en 1 600 ms. ——— */
export function entrarQuieta(tipo: TipoRiesgo, cita: string | null, demo: boolean): void {
  if (!demo && hayDatos()) guardarBorrador() // lo ya marcado queda como borrador
  cancelar()
  S.quieta = { tipo, cita, demo }; S.cuidado = null; $('#btnRapido').setAttribute('aria-pressed', 'false')
  if (Mic.activo) detenerMic(false)
  Voz.callar(); Viajeras.limpiar(); Cab.pendiente = false; Cab.ayer = false; cerrarMenuMas()
  soltarFlip()
  compactar(true, true); alInicio(true)
  Onda.soltarFirma(); Onda.estado('quieta')
  limpiarControles(); $('#editor').hidden = true; $('#penta').hidden = true; $('#muelle').hidden = true; $('#saltos').hidden = true; $('#senal').hidden = true
  $('#frase').textContent = ''; $('#ayuda').textContent = ''; $('#dijo').textContent = ''; $('#dicho').classList.add('vacio'); $('#dicho').removeAttribute('aria-busy'); $('#srPiensa').textContent = ''
  const panel = h('div', { class: 'quieta' })
  const real = conectada() // conectada, ni la demostración habla de ejemplo ni promete avisos
  panel.append(h('span', { class: 'marca-ejemplo' }, demo ? 'Demostración · texto pendiente de revisión por un profesional' : real ? 'Texto pendiente de revisión por un profesional' : 'Ejemplo · texto pendiente de revisión por un profesional'),
    h('p', { class: 'quieta-texto', tabindex: '-1' }, tu('Lo que escribiste me importa. Me quedo quieta y no te hago más preguntas. Si estás en peligro o piensas en hacerte daño, llama ahora: te contestan personas, a cualquier hora.', 'Lo que escribió me importa. Me quedo quieta y no le hago más preguntas. Si está en peligro o piensa en hacerse daño, llame ahora: le contestan personas, a cualquier hora.')))
  ;(LIN_QUIETA[tipo] || LIN_QUIETA.vida).forEach(([numero, txt, rot]) => {
    panel.append(h('a', { class: 'btn-quieta', href: 'tel:' + numero }, txt),
      h('div', { class: 'numero-quieta' }, h('span', null, rot), h('span', { class: 'mono' }, numero), h('button', { type: 'button', class: 'chip', onclick: (e) => void copiar(numero, e.currentTarget as Element) }, 'Copiar número')))
  })
  /* Conectada, la pantalla NO promete un aviso: hoy nada le llega a nadie desde aquí, y decir lo contrario dejaría a la persona esperando. */
  if (real) panel.append(h('p', { class: 'quieta-texto' }, tu('Desde aquí todavía no se le avisa a nadie: esta versión es de prueba para el equipo. Si es urgente, no esperes: llama al 123.', 'Desde aquí todavía no se le avisa a nadie: esta versión es de prueba para el equipo. Si es urgente, no espere: llame al 123.')),
    h('p', { class: 'nota-quieta' }, demo ? 'Demostración: así se ve cuando Praxis se detiene. Nada se guardó ni se envió.' : tu('Lo que escribiste no se guardó ni se envió. Hoy no hay más preguntas.', 'Lo que escribió no se guardó ni se envió. Hoy no hay más preguntas.')))
  else panel.append(h('p', { class: 'quieta-texto' }, demo ? tu('En la app, Bryan ya recibe tu frase. Bryan no es psicólogo y puede tardar en leer. Si es urgente, no lo esperes: llama al 123.', 'En la app, Bryan ya recibe su frase. Bryan no es psicólogo y puede tardar en leer. Si es urgente, no lo espere: llame al 123.') : tu('Bryan ya recibió tu frase. Bryan no es psicólogo y puede tardar en leer. Si es urgente, no lo esperes: llama al 123.', 'Bryan ya recibió su frase. Bryan no es psicólogo y puede tardar en leer. Si es urgente, no lo espere: llame al 123.')))
  if (!real) panel.append(h('p', { class: 'nota-quieta' }, demo ? 'Demostración: en este ejemplo no se envía nada. Hoy no hay firma, ni eco, ni idea.' : tu('Lo que ya marcaste queda como borrador. En este prototipo no se envía nada. Hoy no hay firma, ni eco, ni idea.', 'Lo que ya marcó queda como borrador. En este prototipo no se envía nada. Hoy no hay firma, ni eco, ni idea.')))
  if (demo && S.turno !== 'demo') panel.append(h('div', { class: 'pie-controles' }, h('button', { type: 'button', class: 'seguir', onclick: () => cerrarSala() }, 'Salir de la demostración')))
  soltarSalidaControles() // el panel de la Quieta se ve desde el primer cuadro, aunque una salida de controles estuviera a medias
  $('#controles').append(panel)
  const p1 = panel.querySelector<HTMLElement>('.quieta-texto')
  try { if (p1) p1.focus({ preventScroll: true }) } catch { /* nada */ } // el foco va al primer párrafo (no role=alert: se leería dos veces)
  if (!demo) fijarHecho({ riesgo: tipo, datos: {}, idea: null, dia: hoyReal() })
}

/* ——— El micrófono no existe en el prototipo: la escucha es una simulación ——— */
const VOZ_EJ: Record<string, string[]> = {
  hilo: ['A medias.', 'Sí, salió.'],
  noche: ['Dormí como seis horas, me acosté a las doce, me levanté a las seis y diez, a saltos, y amanecí muy cansada.', 'Dormí bien, unas ocho horas, amanecí descansada.'],
  entreno: ['Hice pierna, me fue bien, pero hoy tengo pocas ganas.'],
  cuerpo: ['La rodilla izquierda, poquito.', 'Nada me duele.'],
  mesa: ['Hambre como seis, comí bien, estrés alto, semana pesada en el trabajo.'],
  firma: ['Unos 9.500 pasos.'],
}
export const Mic = { activo: false, int: 0, env: [] as number[] }
/** La envolvente de una voz inventada: lo que pinta el disco cuando «escucha». */
export function vozSimulada(t: number): number { return clamp(0.3 + 0.45 * Math.abs(Math.sin(t * 9.5)) * (0.6 + 0.4 * Math.sin(t * 2.3)) + 0.2 * Math.random(), 0, 1) }
export function iniciarMic(): void {
  if (S.listo || S.quieta || conectada()) return // conectada no hay micrófono: la escucha de la maqueta era una simulación
  Voz.callar(); Mic.activo = true; Mic.env = []; Onda.fuente(true)
  const b = $('#btnMic')
  b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Detener la escucha simulada')
  Onda.estado('escucha'); $('#ayuda').textContent = 'Escuchando… (simulación: aquí no hay micrófono)'
  const t0 = performance.now()
  Mic.int = window.setInterval(() => {
    const t = (performance.now() - t0) / 1000
    const v = vozSimulada(t)
    Onda.usuario(v); Mic.env.push(v)
    if (t > 2.6) detenerMic(true)
  }, 60)
}
export function detenerMic(mostrar: boolean): void {
  if (!Mic.activo) return
  clearInterval(Mic.int); Mic.activo = false; Onda.fuente(false)
  const b = $('#btnMic')
  b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Micrófono (simulación)')
  Onda.estado('reposo')
  if (!S.espejoHecho && Mic.env.length) { S.espejoHecho = true; Onda.espejo(Mic.env.slice(-17)) } // tu voz pinta: la cresta repite tu ritmo 1 s
  if (!mostrar) { $('#ayuda').textContent = ''; return }
  const muestras = VOZ_EJ[S.turno || ''] || []
  $('#ayuda').textContent = muestras.length ? tu('Simulación: elige lo que habrías dicho.', 'Simulación: elija lo que habría dicho.') : tu('Simulación: aquí no hay frases de ejemplo. Toca una opción.', 'Simulación: aquí no hay frases de ejemplo. Toque una opción.')
  const box = $('#sugerencias')
  box.textContent = ''
  muestras.forEach((t) => box.append(h('button', { type: 'button', class: 'sug', title: t, onclick: () => { ponerSugerencias(S.muestras); $('#ayuda').textContent = ''; enviarTexto(t, 'voz') } }, h('b', null, 'SIMULACIÓN'), t)))
}
export function enviarTexto(t: string, fuente: Fuente): void {
  if (S.listo || S.quieta) return
  if (S.cuidado) { aviso(tu('Antes de seguir, respóndeme con un toque.', 'Antes de seguir, respóndame con un toque.')); return }
  // Conectada, el filtro de riesgo lo aplica la conversación (`decidirTurno`) a CADA frase, antes de cualquier otra cosa.
  if (!conectada() && revisarRiesgo(t, fuente)) return // lo grave detiene; lo ambiguo se pregunta
  cortarDecir()
  emitir({ tipo: 'texto', txt: t, fuente })
}
