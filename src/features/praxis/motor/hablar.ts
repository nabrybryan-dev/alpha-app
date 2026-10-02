import { Barra } from './barra'
import { esOrdenDeEscribir, limpiarDictado } from './dictado'
import { $, h } from './dom'
import { alDesmontar, escuchar, tu, vibrar } from './entorno'
import { clamp } from './movimiento'
import { Onda } from './onda'
import { cerrarSala } from './sala'
import { Mic, enviarTexto } from './senales'
import { Dia, S, cortarDecir } from './sesion'
import { Voz } from './voz'

/**
 * Mantener presionado el agujero para hablar con Praxis (Bryan, 2-oct).
 *
 * Mantener ≥ 250 ms (`UMBRAL_MS`) abre el reconocimiento de voz DEL NAVEGADOR (Google en
 * Android/Chrome, Apple en iPhone); un toque corto no graba nada. Mientras se mantiene,
 * el agujero escucha: el disco pasa a plata, las ondas se rizan con cada resultado y lo
 * que va entendiendo se lee debajo. Al soltar, piensa: lo final, ya limpio de pausas
 * (`dictado.ts`), entra por `enviarTexto(…, 'voz')`, el MISMO camino que lo escrito, con
 * el filtro de riesgo primero.
 *
 * La app NO toca el audio: ni getUserMedia ni MediaRecorder; solo recibe texto del
 * reconocedor. Por eso no hay nivel de voz real: las ondas se mueven con los resultados.
 *
 * «Según qué tan duro uno le hunda» (Bryan): en la web el iPhone no entrega la fuerza del
 * toque (3D Touch desapareció con el iPhone 11 y `pointer.pressure` llega fijo), así que
 * hablar NUNCA depende de la presión. Si un aparato sí manda presión que varía (un lápiz,
 * algunos Android), solo hunde un poco más el agujero: realce visual, no requisito.
 *
 * Teclado: con el foco en el agujero, mantener la barra espaciadora hace lo mismo.
 */
export const UMBRAL_MS = 250
export const TOMA_MAX_MS = 60_000
const ESPERA_FINAL_MS = 2500

interface Alternativa { transcript: string }
interface ResultadoVoz { readonly isFinal: boolean; readonly length: number; readonly [i: number]: Alternativa }
interface EventoVoz { resultIndex: number; results: ArrayLike<ResultadoVoz> }
interface Reconocedor {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number
  onresult: ((e: EventoVoz) => void) | null; onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
type ConstructorReconocedor = new () => Reconocedor

type Fase = 'libre' | 'armando' | 'oyendo' | 'cerrando'
const T = {
  fase: 'libre' as Fase, rec: null as Reconocedor | null, final: '', interino: '', enviar: true, porTiempo: false, error: '',
  tUmbral: 0, tMax: 0, tFin: 0, puntero: -1, presiones: new Set<number>(),
}

/** El reconocedor del navegador, si lo hay. */
export function reconocedor(): ConstructorReconocedor | null {
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}
const sinMicrofono = () => tu('Este navegador no deja usar el micrófono aquí; usa el micrófono del teclado.', 'Este navegador no deja usar el micrófono aquí; use el micrófono del teclado.')
const conPermiso = () => !!(Dia.permisos && Dia.permisos.cVoz)
const bloqueada = () => $('#sala').hidden || !!S.quieta || S.listo || S.respirando

function decirAbajo(txt: string, accion?: Node): void {
  const a = $('#ayuda')
  a.textContent = txt
  if (accion) a.append(' ', accion)
}
/* Sin el permiso no se graba: se dice dónde darlo y un toque lleva hasta la casilla */
function comoDarPermiso(): void {
  const ir = h('button', { type: 'button', class: 'enlace enlace-plata', onclick: () => {
    cerrarSala()
    window.setTimeout(() => {
      const c = $<HTMLInputElement>('#cVoz'), d = c.closest('details')
      if (d) d.open = true
      try { c.scrollIntoView({ block: 'center' }); c.focus({ preventScroll: true }) } catch { /* nada */ }
    }, 450)
  } }, tu('Ir a «Tus permisos»', 'Ir a «Sus permisos»'))
  decirAbajo(tu('Para hablarme con tu voz, activa «Usar mi voz» en «Tus permisos».', 'Para hablarme con su voz, active «Usar mi voz» en «Sus permisos».'), ir)
}

function boton(): HTMLElement { return $('#agujeroHablar') }
function mostrarEscucha(si: boolean): void {
  boton().setAttribute('aria-pressed', String(si))
  $('#ondaCaja').classList.toggle('escuchando', si)
  Onda.oir(si); Onda.fuente(si)
  if (!si) Onda.hundir(0)
}

/** Presionar (dedo, ratón o barra espaciadora). Devuelve false si no empieza nada. */
function presionar(): boolean {
  if (T.fase !== 'libre' || bloqueada()) return false
  if (S.cuidado) { decirAbajo(tu('Antes de seguir, respóndeme con un toque.', 'Antes de seguir, respóndame con un toque.')); return false }
  if (!conPermiso()) { comoDarPermiso(); return false }
  if (!reconocedor()) { decirAbajo(sinMicrofono()); return false }
  T.fase = 'armando'; T.presiones.clear()
  Onda.hundir(1) // se hunde desde el primer instante: así se nota que el toque llegó
  T.tUmbral = window.setTimeout(empezar, UMBRAL_MS)
  return true
}

function empezar(): void {
  if (T.fase !== 'armando') return
  T.fase = 'libre'
  const C = reconocedor()
  if (bloqueada() || !C) { Onda.hundir(0); return }
  Voz.callar(); cortarDecir() // que Praxis no se oiga a sí misma
  let rec: Reconocedor
  try {
    rec = new C()
    rec.lang = 'es-CO'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1
    rec.onresult = alResultado; rec.onerror = alError; rec.onend = terminar
    rec.start()
  } catch { Onda.hundir(0); decirAbajo(sinMicrofono()); return }
  Object.assign(T, { rec, final: '', interino: '', enviar: true, porTiempo: false, error: '', fase: 'oyendo' as Fase })
  mostrarEscucha(true); Onda.estado('escucha'); vibrar()
  $('#enVivo').textContent = ''; $('#ayuda').textContent = ''
  $('#srPiensa').textContent = tu('Te escucho. Suelta para enviar.', 'Le escucho. Suelte para enviar.')
  T.tMax = window.setTimeout(() => { if (T.fase === 'oyendo') { T.porTiempo = true; cerrar() } }, TOMA_MAX_MS)
}

function alResultado(e: EventoVoz): void {
  const finales: string[] = [], interinos: string[] = []
  for (let i = 0; i < e.results.length; i++) {
    const r = e.results[i], tx = (r && r[0] && r[0].transcript) || ''
    if (r.isFinal) finales.push(tx); else interinos.push(tx)
  }
  const antes = T.final.length + T.interino.length
  T.final = finales.join(' ').replace(/\s+/g, ' ').trim(); T.interino = interinos.join(' ').replace(/\s+/g, ' ').trim()
  if (T.fase !== 'oyendo') return
  const nuevo = Math.max(0, T.final.length + T.interino.length - antes)
  Onda.nivel(clamp(0.35 + nuevo / 14, 0.35, 1)); Onda.usuario(0.5) // sin audio propio: cada palabra nueva es el pulso de la voz
  const vivo = (T.final + ' ' + T.interino).trim()
  $('#enVivo').textContent = vivo ? vivo + '…' : ''
}
function alError(e: { error?: string }): void {
  const err = (e && e.error) || ''
  if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') T.error = 'microfono'
  else if (err === 'network') T.error = 'red'
}

/** Soltar: deja de oír y espera lo final del reconocedor (como mucho 2,5 s). */
function cerrar(): void {
  if (T.fase !== 'oyendo') return
  T.fase = 'cerrando'; clearTimeout(T.tMax)
  mostrarEscucha(false)
  if (!T.error) Onda.estado('piensa') // al soltar, piensa
  T.tFin = window.setTimeout(terminar, ESPERA_FINAL_MS)
  try { if (T.rec) T.rec.stop() } catch { terminar() }
}
function soltar(): void {
  if (T.fase === 'armando') { // un toque corto: no se graba nada, solo se enseña el gesto
    clearTimeout(T.tUmbral); T.fase = 'libre'; Onda.hundir(0)
    decirAbajo(tu('Mantén presionado el agujero mientras hablas.', 'Mantenga presionado el agujero mientras habla.'))
    return
  }
  cerrar()
}

function terminar(): void {
  if (T.fase !== 'oyendo' && T.fase !== 'cerrando') return
  if (T.fase === 'oyendo') { clearTimeout(T.tMax); mostrarEscucha(false) } // el reconocedor se cerró solo: cuenta como soltar
  clearTimeout(T.tFin)
  const rec = T.rec
  T.rec = null; T.fase = 'libre'
  if (rec) { rec.onresult = null; rec.onerror = null; rec.onend = null }
  $('#enVivo').textContent = ''
  if ($('#srPiensa').textContent === tu('Te escucho. Suelta para enviar.', 'Le escucho. Suelte para enviar.')) $('#srPiensa').textContent = ''
  if (S.quieta) return // la seguridad ya tomó la pantalla: no se toca nada
  const estado = Onda.estadoActual
  if (estado === 'piensa' || estado === 'escucha') Onda.estado('reposo')
  if (!T.enviar || $('#sala').hidden) return
  if (T.error === 'microfono') { decirAbajo(sinMicrofono()); return }
  const texto = limpiarDictado(T.final || T.interino) // lo final; si el reconocedor no alcanzó a cerrarlo, lo último que se vio en pantalla
  if (!texto) { decirAbajo(T.error === 'red' ? tu('No pude entenderte: el reconocimiento de voz necesita internet.', 'No pude entenderle: el reconocimiento de voz necesita internet.') : tu('No te oí. Mantén presionado el agujero mientras hablas.', 'No le oí. Mantenga presionado el agujero mientras habla.')); return }
  if (esOrdenDeEscribir(texto)) { Barra.abrir(); return }
  if (T.porTiempo) decirAbajo(tu('Un minuto como máximo por toma: envié lo que entendí.', 'Un minuto como máximo por toma: envié lo que entendí.'))
  enviarTexto(texto, 'voz') // el mismo camino que lo escrito: el filtro de riesgo va primero
}

/** Corta la toma sin enviar nada (la Quieta, la pestaña oculta, salir de la ruta). */
export function cancelarToma(): void {
  if (T.fase === 'armando') { clearTimeout(T.tUmbral); T.fase = 'libre'; Onda.hundir(0); return }
  if (T.fase === 'libre') return
  T.enviar = false
  const rec = T.rec
  if (T.fase === 'oyendo') { T.fase = 'cerrando'; clearTimeout(T.tMax); mostrarEscucha(false) }
  try { if (rec) rec.abort() } catch { /* nada */ }
  terminar()
}

/* La presión solo realza: si llega y VARÍA (un lápiz, algunos Android), el agujero se hunde un poco más; el valor fijo del iPhone (0 / 0,5 / 1) se ignora */
function leerPresion(e: PointerEvent): void {
  if (e.pointerType === 'mouse' || !(e.pressure > 0)) return
  T.presiones.add(Math.round(e.pressure * 100))
  if (T.presiones.size >= 3) Onda.hundir(1 + 0.5 * clamp(e.pressure, 0, 1))
}

/* El botón va justo sobre el agujero: se recoloca cada vez que el lienzo se mide o la caja cambia */
function colocar(): void {
  const g = Onda.objetivo(), b = boton()
  if (!g) return
  const d = Math.max(96, g.Rh * 3.2)
  b.style.left = g.cx.toFixed(1) + 'px'; b.style.top = g.cy.toFixed(1) + 'px'
  b.style.width = b.style.height = d.toFixed(0) + 'px'
}

export function conectarHablar(): void {
  const b = boton()
  Object.assign(T, { fase: 'libre', rec: null, puntero: -1 })
  Mic.cortarVoz = cancelarToma
  Onda.alMedir(colocar); colocar()
  const liberar = () => { if (T.puntero < 0) return; try { b.releasePointerCapture(T.puntero) } catch { /* nada */ } T.puntero = -1 }
  escuchar<PointerEvent>(b, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!presionar()) return
    T.puntero = e.pointerId ?? 0
    try { b.setPointerCapture(e.pointerId) } catch { /* nada */ }
    leerPresion(e)
  })
  escuchar<PointerEvent>(b, 'pointermove', (e) => { if (T.fase !== 'libre' && e.pointerId === T.puntero) leerPresion(e) })
  const alSoltar = (e: PointerEvent) => { if (T.puntero < 0 || (e.pointerId ?? 0) !== T.puntero) return; liberar(); soltar() }
  escuchar<PointerEvent>(b, 'pointerup', alSoltar)
  escuchar<PointerEvent>(b, 'pointercancel', alSoltar)
  escuchar(b, 'contextmenu', (e) => e.preventDefault()) // mantener no abre el menú del sistema
  const esEspacio = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Spacebar'
  escuchar<KeyboardEvent>(b, 'keydown', (e) => { if (!esEspacio(e)) return; e.preventDefault(); if (!e.repeat) presionar() })
  escuchar<KeyboardEvent>(b, 'keyup', (e) => { if (!esEspacio(e)) return; e.preventDefault(); if (T.puntero < 0) soltar() })
  escuchar(b, 'blur', () => { if (T.puntero < 0 && T.fase !== 'libre') soltar() })
  escuchar(document, 'visibilitychange', () => { if (document.hidden) cancelarToma() })
  alDesmontar(() => { liberar(); cancelarToma(); Mic.cortarVoz = null })
}
