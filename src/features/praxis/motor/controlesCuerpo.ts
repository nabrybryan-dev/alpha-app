import { refrescar } from './cabecera'
import { chips, stepper } from './controles'
import { ULTIMO_PESO } from './datos'
import { $, alCambiarValor, aviso, h, sv } from './dom'
import { reducido, tu, vibrar } from './entorno'
import { decirCorto } from './frase'
import { M_TIRA, clamp, muelle, num } from './movimiento'
import { Onda } from './onda'
import { quitarDato, tocar } from './penta'
import { revisarRiesgo } from './senales'
import { E, S, emitir, faltantes } from './sesion'
import { fmtMiles, fmtNum, sesion } from './texto'

/* El cuerpo: «Nada me duele», zonas y el dial de 11 muescas */
const TRAMO_DOLOR = (v: number | undefined) => (v == null ? '' : v === 0 ? 'ninguno' : v <= 3 ? 'leve' : v <= 6 ? 'moderado' : 'intenso')
const TRAMO_HAMBRE = (v: number | undefined) => (v == null ? '' : v <= 3 ? 'leve' : v <= 6 ? 'moderada' : v <= 8 ? 'intensa' : 'insostenible')

export function avisoBryan(): void { aviso(tu('En la app, Bryan recibe tu aviso con tu frase. En este prototipo no se envía nada.', 'En la app, Bryan recibe su aviso con su frase. En este prototipo no se envía nada.')) }
export function rotuloBryan(): string { return tu('Díselo a Bryan', 'Dígaselo a Bryan') }

export function controlDolor(): HTMLElement[] {
  const d = S.datos
  const out: HTMLElement[] = []
  out.push(h('button', { type: 'button', class: 'btn-ancho', 'aria-pressed': String(d.dolor === 0), 'data-k': 'nada', onclick: () => { S.mostrarDial = false; tocar('dolor', 0) } }, 'Nada me duele'))
  const zonas: [string, string, (string | null)?][] = [['Rodilla izquierda', 'rodilla izquierda', E.dolorAyer === 'si' ? 'de ayer' : null], ['Lumbar', 'lumbar'], ['Otra', '__otra']]
  const zg = h('div', { class: 'grupo' }, h('div', { class: 'grupo-rot' }, h('span', null, E.dolorAyer === 'si' && d.dolorDonde == null ? '¿Sigue en la rodilla?' : '¿Dónde?')))
  zg.append(chips(zonas, (v) => {
    if (v === '__otra') { S.otraZona = true; S.mostrarDial = true; refrescar(); return }
    S.otraZona = false; S.mostrarDial = true
    if (S.datos.dolor === 0) quitarDato('dolor')
    tocar('dolorDonde', v)
  }, S.otraZona ? '__otra' : d.dolorDonde, 'zona'))
  if (S.otraZona) {
    const inp = h('input', { class: 'texto-libre', type: 'text', id: 'zonaOtra', placeholder: 'Hombro derecho, cadera…', 'aria-label': 'Otra zona', 'data-k': 'zonaOtra' })
    inp.addEventListener('change', () => {
      const v = inp.value.trim()
      if (!v) return
      if (revisarRiesgo(v, 'texto')) return // el texto libre también se revisa
      if (S.datos.dolor === 0) quitarDato('dolor')
      tocar('dolorDonde', v.toLowerCase(), 'texto', v)
    })
    zg.append(inp)
  }
  out.push(zg)
  if (S.mostrarDial || num(d.dolor) > 0 || d.dolorDonde) {
    const dial = h('div', { class: 'grupo' })
    dial.append(h('div', { class: 'grupo-rot' }, h('span', null, 'Del 0 al 10')))
    const fila = h('div', { class: 'dial', role: 'group', 'aria-label': 'Dolor del 0 al 10: 0 es nada y 10, el peor dolor' })
    const arco = sv('svg', { class: 'dial-arco', viewBox: '0 0 100 56', 'aria-hidden': 'true' })
    arco.append(sv('path', { d: 'M6 50 A44 44 0 0 1 94 50' })); fila.append(arco)
    for (let i = 0; i <= 10; i++) { // once astros en un arco: 0 a la izquierda, 10 a la derecha
      const th = Math.PI - (i * Math.PI) / 10, pos = 'left:' + (50 + 44 * Math.cos(th)).toFixed(2) + '%;top:' + (((0.5 - 0.44 * Math.sin(th)) / 0.56) * 100).toFixed(2) + '%'
      fila.append(h('button', { type: 'button', class: 'muesca' + (i >= 4 ? ' ambar' : ''), style: pos, 'aria-pressed': String(d.dolor === i), 'aria-label': 'Dolor ' + i, 'data-k': 'dial:' + i, onclick: () => tocar('dolor', i) }, String(i)))
    }
    fila.append(h('div', { class: 'dial-cifra' + (d.dolor == null ? ' vacia' : ''), 'aria-hidden': 'true' }, d.dolor == null ? '—' : String(d.dolor)))
    dial.append(fila, h('div', { class: 'dial-extremos', 'aria-hidden': 'true' }, h('span', null, '0 nada'), h('span', null, '10, el peor')), h('div', { class: 'tramo' }, TRAMO_DOLOR(d.dolor)))
    out.push(dial)
  } else {
    out.push(chips([['Algo me duele', 'algo']], () => { S.mostrarDial = true; if (S.datos.dolor === 0) quitarDato('dolor'); Onda.estado('aplanada'); refrescar() }, null, 'algo'))
  }
  if (num(d.dolor) >= 7) out.push(h('button', { type: 'button', class: 'btn-rojo-borde', onclick: avisoBryan }, rotuloBryan()))
  return out
}
/* La tira del hambre: una sola tira de diez haces. El valor lo da la posición del dedo (seguimiento 1:1 desde el pointerdown, con pointer capture)
   y al soltar encaja en el entero con el muelle TIRA_HAMBRE. Los haces se encienden por --v (fraccionario), no por clases. */
function tiraHambre(v: number | undefined): HTMLElement {
  const el = h('div', { class: 'tira', role: 'slider', tabindex: '0', 'data-k': 'tira', 'data-libre': '', 'data-valor': v == null ? '' : String(v), 'aria-label': tu('Hambre del 1 al 10: 1 es casi nada y 10, que no podías más', 'Hambre del 1 al 10: 1 es casi nada y 10, que no podía más'), 'aria-valuemin': '1', 'aria-valuemax': '10' })
  if (v != null) { el.setAttribute('aria-valuenow', String(v)); el.setAttribute('aria-valuetext', v + ', ' + TRAMO_HAMBRE(v)) }
  const haces = h('div', { class: 'tira-haces', 'aria-hidden': 'true' }), nums = h('div', { class: 'tira-nums', 'aria-hidden': 'true' })
  for (let i = 1; i <= 10; i++) { haces.append(h('span', { class: 'haz', style: '--n:' + i }, h('i'), h('b', null, h('i')))); nums.append(h('span', null, String(i))) }
  el.append(haces, nums)
  const s = { x: v == null ? 0 : v, v: 0 }
  let raf = 0, objetivo = s.x, arrastrando = false, tPrev = 0
  const pintar = () => { el.style.setProperty('--v', s.x.toFixed(3)); const on = Math.round(s.x); Array.from(nums.children).forEach((n, i) => n.classList.toggle('on', i + 1 === on)) }
  const paso = (ahora: number) => {
    raf = 0
    const dt = Math.min(0.05, (ahora - tPrev) / 1000 || 0.016)
    tPrev = ahora
    if (arrastrando) return
    muelle(s, objetivo, dt, ...M_TIRA); pintar()
    if (Math.abs(s.x - objetivo) > 0.004 || Math.abs(s.v) > 0.01) raf = requestAnimationFrame(paso); else { s.x = objetivo; s.v = 0; pintar() }
  }
  const ir = (n: number) => { objetivo = n == null || isNaN(n) ? 0 : n; if (reducido()) { s.x = objetivo; s.v = 0; pintar(); return } if (!raf) { tPrev = performance.now(); raf = requestAnimationFrame(paso) } }
  alCambiarValor(el, ir)
  const valorEn = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return clamp(((e.clientX - r.left) / r.width) * 10, 0, 10) }
  const confirmar = () => { const i = clamp(Math.ceil(s.x - 0.0001), 1, 10); objetivo = i; arrastrando = false; ir(i); Onda.pulso(); vibrar(); tocar('hambreEscala', i) }
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); arrastrando = true; if (raf) { cancelAnimationFrame(raf); raf = 0 } s.x = valorEn(e); s.v = 0; pintar() })
  el.addEventListener('pointermove', (e) => { if (!arrastrando || !el.hasPointerCapture(e.pointerId)) return; s.x = valorEn(e); pintar(); Onda.usuario(0.25) })
  el.addEventListener('pointerup', (e) => { if (!arrastrando) return; try { el.releasePointerCapture(e.pointerId) } catch { /* nada */ } confirmar() })
  el.addEventListener('pointercancel', () => { arrastrando = false; ir(objetivo) })
  el.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); tocar('hambreEscala', e.key === 'Home' ? 1 : 10); return }
    if (!d) return
    e.preventDefault()
    const base = S.datos.hambreEscala == null ? (d > 0 ? 0 : 11) : S.datos.hambreEscala
    tocar('hambreEscala', clamp(base + d, 1, 10))
  })
  pintar()
  return el
}
export function controlHambre(): HTMLElement {
  const v = S.datos.hambreEscala
  const g = h('div', { class: 'grupo' })
  g.append(h('div', { class: 'grupo-rot' }, h('span', null, E.franja === 'manana' ? 'Hambre de ayer' : 'Hambre de hoy'), h('span', { class: 'mono' }, v == null ? '1 – 10' : v + ' · ' + TRAMO_HAMBRE(v))))
  g.append(tiraHambre(v), h('div', { class: 'dial-extremos', 'aria-hidden': 'true' }, h('span', null, '1, casi nada'), h('span', null, '10, no podía más')), h('div', { class: 'tramo' }, TRAMO_HAMBRE(v)))
  return g
}

export function controlEntreno(): HTMLElement {
  const d = S.datos
  const g = h('div', { class: 'grupo' }, h('div', { class: 'grupo-rot' }, h('span', null, E.franja === 'manana' ? 'El entreno de ayer' : 'El entreno de hoy')))
  const sel = d.entreno == null ? null : ['LEG A', 'Descansé'].includes(d.entreno) ? d.entreno : '__otra'
  g.append(chips<string>([[sesion('LEG A'), 'LEG A', 'del plan'], ['Otra cosa', '__otra'], ['Descansé', 'Descansé']], (v) => {
    if (v === '__otra') { S.otroEntreno = true; refrescar(); return }
    S.otroEntreno = false; tocar('entreno', v)
  }, S.otroEntreno ? '__otra' : sel, 'entreno'))
  if (S.otroEntreno) {
    const inp = h('input', { class: 'texto-libre', type: 'text', id: 'entrenoOtro', placeholder: tu('Qué hiciste', 'Qué hizo'), 'aria-label': 'Otro entreno', 'data-k': 'entrenoOtro' })
    inp.addEventListener('change', () => {
      const v = inp.value.trim()
      if (!v) return
      if (revisarRiesgo(v, 'texto')) return // el texto libre también se revisa
      tocar('entreno', v, 'texto', v)
    })
    g.append(inp)
  }
  return g
}

/* ——— Las filas de la firma ——— */
/* Un número que nadie dio no se pone: el campo arranca vacío y el último valor, si acaso, se ofrece como fantasma */
function campoNumero(rot: string, ph: string, unidad: string, alConfirmar: (t: string) => void, modo: string): HTMLElement {
  const inp = h('input', { type: 'text', inputmode: modo, placeholder: ph, 'aria-label': rot, 'data-k': 'num:' + rot })
  inp.addEventListener('change', () => { if (inp.value.trim()) alConfirmar(inp.value.trim()) })
  return h('div', { class: 'campo-num' }, inp, h('span', { class: 'u' }, unidad))
}
export function filaPasos(): HTMLElement {
  const rot = h('span', { class: 'rot' }, E.franja === 'manana' ? tu('¿Cuántos pasos diste ayer?', '¿Cuántos pasos dio ayer?') : tu('¿Cuántos pasos llevas hoy?', '¿Cuántos pasos lleva hoy?'), h('small', null, S.datos.pasos == null ? tu('Si no sabes, se queda en blanco.', 'Si no sabe, se queda en blanco.') : tu('Toca − o + para ajustar.', 'Toque − o + para ajustar.')))
  if (S.datos.pasos != null) return h('div', { class: 'fila-firma' }, rot, stepper(S.datos.pasos, { min: 0, max: 100000, paso: 500, inicio: S.datos.pasos, fmt: fmtMiles, rot: 'Pasos' }, (v) => tocar('pasos', v)))
  return h('div', { class: 'fila-firma' }, rot, campoNumero('Pasos', 'ej. 9500', 'pasos', (t) => { const v = parseInt(t.replace(/\D/g, ''), 10); if (v >= 0 && v <= 100000) tocar('pasos', v) }, 'numeric'))
}
export function filaPeso(): HTMLElement {
  const box = h('div', { class: 'fila-firma' }, h('span', { class: 'rot' }, tu('¿Te pesaste en ayunas?', '¿Se pesó en ayunas?'), h('small', null, 'El peso va aparte: nunca se dibuja ni suena.')))
  if (S.pesoSi === true && S.peso != null) box.append(stepper(S.peso, { min: 30, max: 250, paso: 0.1, inicio: S.peso, fmt: (v) => fmtNum(v.toFixed(1)) + ' kg', rot: 'Peso', unidad: ' kg' }, (v) => { S.peso = Math.round(v * 10) / 10; refrescar() }))
  else if (S.pesoSi === true) {
    box.append(campoNumero('Peso en kilos', 'ej. 64,2', 'kg', (t) => { const v = parseFloat(t.replace(',', '.')); if (v >= 30 && v <= 250) { S.peso = Math.round(v * 10) / 10; refrescar() } }, 'decimal'),
      chips([['Igual que la última vez', 'ult', fmtNum(ULTIMO_PESO) + ' kg']], () => { S.peso = ULTIMO_PESO; refrescar() }, null, 'peso-ult'))
  } else box.append(chips<boolean>([['Sí', true], ['Hoy no', false]], (v) => { S.pesoSi = v; if (!v) { S.peso = null; decirCorto('Listo, hoy no.') } refrescar() }, S.pesoSi, 'peso'))
  return box
}
export function filaComentarios(): HTMLElement {
  const inp = h('input', { class: 'texto-libre', type: 'text', id: 'comentariosFirma', value: S.datos.comentarios || '', placeholder: 'Opcional', 'aria-label': '¿Algo más para Bryan?', 'data-k': 'coment' })
  inp.addEventListener('change', () => {
    const v = inp.value.trim()
    if (v) { if (revisarRiesgo(v, 'texto')) return; tocar('comentarios', v, 'texto', v) } // el texto libre también se revisa
    else if (S.datos.comentarios) quitarDato('comentarios')
  })
  return h('div', { class: 'grupo' }, h('div', { class: 'grupo-rot' }, h('span', null, '¿Algo más para Bryan?')), inp)
}
export function botonListo(): HTMLElement {
  const f = faltantes(S.datos)
  return h('button', { type: 'button', class: 'listo' + (f.length ? ' falta' : ''), 'data-k': 'listo', onclick: () => emitir({ tipo: 'listo' }) }, f.length ? (f.length === 1 ? 'Falta 1' : 'Faltan ' + f.length) : 'Listo')
}
export function irAlHueco(nombrePrimero: string | undefined): void {
  const el = $('#penta .hueco') || $('#controles .ochip, #controles .btn-ancho')
  if (el) { if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: reducido() ? 'auto' : 'smooth' }); el.focus({ preventScroll: true }) }
  if (nombrePrimero) decirCorto('Empecemos por ' + nombrePrimero + '. Un toque y listo.')
}
