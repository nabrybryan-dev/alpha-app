import { Sala, limpiarControles, montar } from './cabecera'
import { gCalidad, gCansancio, pieSeguir } from './controles'
import { $, h } from './dom'
import { escuchar, raiz, reducido, tu } from './entorno'
import { decir, fijarFrase } from './frase'
import { esperar } from './movimiento'
import { Onda } from './onda'
import { Penta } from './penta'
import { abrirSala, cerrarMenuMas, cerrarSala, limpiarSala } from './sala'
import { entrarQuieta, vozSimulada } from './senales'
import { Cancelado, S, cancelar, renovarSesion, vigilar } from './sesion'
import { Voz } from './voz'

/**
 * Selector de estados de la demostración: reposo, escucha, habla Praxis, habla la persona,
 * pensando, quieta, semana, mes. Se cambia con el selector de arriba o con location.hash
 * (#reposo, #escucha, #habla, #persona, #piensa, #quieta, #semana, #mes).
 * Ningún id de la escena puede llamarse como uno de esos tokens: el navegador desplaza al
 * fragmento que coincide con un id (por eso el párrafo de lo que dijo la persona es #dijo).
 */
const ESTADOS: [string, string][] = [['reposo', 'Reposo'], ['escucha', 'Escucha'], ['habla', 'Habla Praxis'], ['persona', 'Habla la persona'], ['piensa', 'Pensando'], ['quieta', 'Quieta'], ['semana', 'Semana'], ['mes', 'Mes']]
const ALIAS: Record<string, string> = { 'habla-praxis': 'habla', praxis: 'habla', 'habla-persona': 'persona', pensando: 'piensa', escuchando: 'escucha', 'la-quieta': 'quieta', semanal: 'semana', mensual: 'mes', respira: 'reposo' }
let timers: number[] = []
function limpiar(): void { timers.forEach((t) => { clearTimeout(t); clearInterval(t) }); timers = [] }
function token(): string | null {
  let t = ''
  try { t = decodeURIComponent((location.hash || '').replace(/^#/, '')).toLowerCase().trim() } catch { /* nada */ }
  t = ALIAS[t] || t
  return t === 'sin-demo' || ESTADOS.some(([k]) => k === t) ? t : null
}
function preparar(): void {
  cancelar(); Voz.callar(); clearTimeout(Sala.tAbrir)
  renovarSesion().turno = 'demo'
  if ($('#sala').hidden) abrirSala('demo', { sinViaje: true })
  limpiarSala(); cerrarMenuMas()
  Object.assign(S.datos, { horasSueno: 6.5, calidadSueno: 'REGULAR' }); Penta.render(); Onda.forma(S.datos) // un poco de vida en el pentagrama, sin estrellas viajando
}
async function bucleHabla(): Promise<void> {
  const tok = S.tok
  try { for (;;) { await decir(tu('Buenos días. ¿Cómo dormiste y cómo amaneciste?', 'Buenos días. ¿Cómo durmió y cómo amaneció?'), tok, { simularVoz: true }); await esperar(1500); vigilar(tok) } }
  catch (e) { if (!(e instanceof Cancelado)) throw e }
}
function ir(t: string): void {
  if (t === 'sin-demo') { raiz().setAttribute('data-demo', 'off'); return }
  raiz().removeAttribute('data-demo')
  const sel = $<HTMLSelectElement>('#demoSel')
  if (sel && sel.value !== t) sel.value = t
  limpiar()
  if (t === 'semana' || t === 'mes') {
    if (!$('#sala').hidden) { cancelar(); cerrarSala(true) }
    const el = $(t === 'semana' ? '#semTit' : '#mesTit')
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 56), behavior: 'auto' })
    return
  }
  preparar()
  if (t === 'quieta') { entrarQuieta('vida', null, true); return }
  fijarFrase(tu('¿Cómo dormiste y cómo amaneciste?', '¿Cómo durmió y cómo amaneció?'))
  montar(() => [gCalidad(), gCansancio(), pieSeguir(true)])
  if (t === 'reposo') Onda.estado('reposo')
  else if (t === 'escucha') { Onda.estado('reposo'); Onda.foco(true); $('#ayuda').textContent = tu('Te escucho.', 'Le escucho.') }
  else if (t === 'habla') { $('#frase').textContent = ''; void bucleHabla() }
  else if (t === 'persona') {
    $('#dijo').textContent = tu('Dijiste (simulación): ', 'Dijo (simulación): ') + '«Dormí como seis horas, a saltos, y amanecí muy cansada.»'
    Onda.estado('escucha'); Onda.fuente(true)
    const t0 = performance.now()
    timers.push(window.setInterval(() => Onda.usuario(vozSimulada((performance.now() - t0) / 1000)), 60))
  } else if (t === 'piensa') {
    Onda.estado('piensa'); $('#dicho').setAttribute('aria-busy', 'true'); $('#srPiensa').textContent = 'Praxis está pensando'
    if (reducido()) $('#ayuda').textContent = 'Pensando…'
    timers.push(window.setTimeout(() => { $('#ayuda').textContent = 'Sigo pensando…' }, 3000))
  }
}
export const Demo = {
  iniciar(): void {
    limpiar()
    const sel = $<HTMLSelectElement>('#demoSel')
    sel.textContent = ''
    sel.append(h('option', { value: '' }, 'elegir un estado…'))
    ESTADOS.forEach(([k, txt]) => sel.append(h('option', { value: k }, txt)))
    escuchar(sel, 'change', () => { const k = sel.value; if (!k) return; if (location.hash === '#' + k) ir(k); else location.hash = '#' + k })
    escuchar($('#demoOff'), 'click', () => raiz().setAttribute('data-demo', 'off'))
    escuchar(window, 'hashchange', () => { const t = token(); if (t) ir(t) })
    const t = token()
    if (t) ir(t)
  },
  detener(): void { limpiar(); limpiarControles() },
}
