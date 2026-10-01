import { refrescar } from './cabecera'
import { controlDolor, controlEntreno, controlHambre, filaComentarios, filaPasos } from './controlesCuerpo'
import { ETQ, ayer, type Campo } from './datos'
import { $, alTocar, h, morphHijos, sv, traerALaVista } from './dom'
import { tu, vibrar } from './entorno'
import { clamp } from './movimiento'
import { Onda } from './onda'
import { anotar, tocar } from './penta'
import { S, emitir, rotulo } from './sesion'
import { fmtDur, fmtHora, fmtNum, minNoche } from './texto'

/* ——— Controles de un toque: astros, arcos y trazos de luz; ninguna caja ——— */
function miniPath(tipo: string, ancho = 28): string {
  const FORMAS: Record<string, number[]> = { MALA: [1, 1.5, 0.35, 9], REGULAR: [1, 1.5, 0.4, 3], BUENA: [1, 1.5, 0, 0], POCO: [0.38, 1.5, 0, 0], MEDIO: [0.7, 2.5, 0, 0], MUCHO: [1, 4.5, 0, 0], lisa: [0.9, 1, 0, 0], rizada: [0.9, 2, 0.3, 7], densa: [0.9, 6, 0.25, 13] }
  const A = FORMAS[tipo] || [1, 1.5, 0, 0]
  let d = ''
  for (let i = 0; i <= 28; i++) {
    const x = i / 28, hann = Math.sin(Math.PI * x)
    const y = 7 - (6 * A[0] * hann * (Math.sin(2 * Math.PI * A[1] * x) + A[2] * Math.sin(2 * Math.PI * A[3] * x))) / (1 + A[2])
    d += (i ? 'L' : 'M') + (x * ancho).toFixed(1) + ' ' + y.toFixed(1)
  }
  return d
}
function svgMini(tipo: string, ancho = 28): SVGElement { const s = sv('svg', { viewBox: `0 0 ${ancho} 14`, 'aria-hidden': 'true' }); s.append(sv('path', { d: miniPath(tipo, ancho) })); return s }
const FORMA_CANT: Record<string, string> = { POCO: 'POCO', REGULAR: 'MEDIO', MUCHO: 'MUCHO' }
const FORMA_ESTRES: Record<string, string> = { POCO: 'lisa', REGULAR: 'rizada', MUCHO: 'densa' }

function grupoOndas(campo: Campo, rot: string, opciones: string[], forma: (o: string) => string, ancha?: boolean): HTMLElement {
  const g = h('div', { class: 'grupo', role: 'group', 'aria-label': rot })
  g.append(h('div', { class: 'grupo-rot' }, h('span', null, rot)))
  const fila = h('div', { class: 'fila orbita' })
  opciones.forEach((o) => {
    const b = h('button', { type: 'button', class: 'ochip' + (ancha ? ' ancha' : ''), 'aria-pressed': String(S.datos[campo] === o), 'data-k': campo + ':' + o, 'aria-label': rot + ': ' + ETQ[campo][o].toLowerCase() + (ancha ? ', onda ' + forma(o) : '') })
    b.append(svgMini(forma(o), ancha ? 44 : 28), h('span', null, ETQ[campo][o]), h('i', { class: 'astro', 'aria-hidden': 'true' }))
    alTocar(b, 'click', () => tocar(campo, o))
    fila.append(b)
  })
  g.append(fila)
  return g
}
const NIVELES = ['MALA', 'REGULAR', 'BUENA'], CANTIDADES = ['POCO', 'REGULAR', 'MUCHO']
export const gCalidad = () => grupoOndas('calidadSueno', 'Calidad del sueño', NIVELES, (o) => o)
export const gCansancio = () => grupoOndas('cansancio', 'Cansancio', CANTIDADES, (o) => FORMA_CANT[o])
export const gRendimiento = () => grupoOndas('rendimiento', S.datos.entreno === 'Descansé' ? tu('Cómo te sentiste descansando', 'Cómo se sintió descansando') : tu('Cómo te fue', 'Cómo le fue'), NIVELES, (o) => o)
export const gGanas = () => grupoOndas('motivacion', 'Ganas de entrenar', CANTIDADES, (o) => FORMA_CANT[o])
export const gAlimentacion = () => grupoOndas('alimentacion', 'Alimentación', NIVELES, (o) => o)
export const gEstres = () => grupoOndas('estres', 'Estrés', CANTIDADES, (o) => FORMA_ESTRES[o], true)

type ValChip = string | number | boolean
export function chips<V extends ValChip>(opciones: (V | [string, V, (string | null)?])[], alElegir: (v: V) => void, sel: V | null | undefined, rot?: string): HTMLElement {
  const f = h('div', { class: 'fila', role: 'group', 'aria-label': rot || 'Opciones' })
  opciones.forEach((o) => {
    const [txt, val, extra] = Array.isArray(o) ? o : ([String(o), o] as [string, V])
    const b = h('button', { type: 'button', class: 'chip' + (extra === 'fantasma' ? ' fantasma' : ''), 'aria-pressed': String(sel != null && sel === val), 'data-k': (rot || 'c') + ':' + val }, txt)
    if (extra && extra !== 'fantasma') b.append(h('small', null, extra))
    alTocar(b, 'click', () => { Onda.pulso(); vibrar(); alElegir(val) })
    f.append(b)
  })
  return f
}
interface Paso { min: number; max: number; paso: number; fmt: (v: number) => string; inicio: number; rot: string; unidad?: string }
export function stepper(valor: number | null, { min, max, paso, fmt, inicio, rot, unidad }: Paso, alCambiar: (v: number) => void): HTMLElement {
  const out = h('output', { class: valor == null ? 'vacio' : '', 'aria-live': 'polite' }, valor == null ? '—' + (unidad || '') : fmt(valor))
  const mover = (s: number) => { const base = valor == null ? inicio : valor + s * paso; alCambiar(clamp(Math.round(base / paso) * paso, min, max)) }
  return h('div', { class: 'stepper', role: 'group', 'aria-label': rot },
    h('button', { type: 'button', 'aria-label': 'Menos', 'data-k': rot + ':-', onclick: () => mover(-1) }, '−'), out,
    h('button', { type: 'button', 'aria-label': 'Más', 'data-k': rot + ':+', onclick: () => mover(1) }, '+'))
}
export function pieSeguir(ok: boolean): HTMLElement {
  return h('div', { class: 'pie-controles' }, h('button', { type: 'button', class: 'seguir', disabled: !ok, 'data-k': 'seguir', onclick: () => emitir({ tipo: 'seguir' }) }, ok ? 'Seguir' : 'Falta un toque'))
}

/* La barra de la noche: 18:00 a 12:00, dos asas; el horario de anoche es un fantasma */
export function enCamaMin(): number | null { if (!S.datos.horaAcostarse || !S.datos.horaLevantarse) return null; return minNoche(S.datos.horaLevantarse) - minNoche(S.datos.horaAcostarse) }
function barraNoche(g: HTMLElement): void {
  const FANTASMA = { a: ayer().horaAcostarse as string, l: ayer().horaLevantarse as string } // el horario de la noche anterior, tomado del lunes de ejemplo
  const TOT = 1080, pct = (m: number) => (m / TOT) * 100 + '%'
  const tocado = S.datos.horaAcostarse != null && S.datos.horaLevantarse != null
  let a = minNoche(S.datos.horaAcostarse || FANTASMA.a), l = minNoche(S.datos.horaLevantarse || FANTASMA.l), arrastrado = false
  const rotHora = h('span', { class: 'mono' }, tocado ? S.datos.horaAcostarse + ' – ' + S.datos.horaLevantarse : 'la noche anterior ' + FANTASMA.a + ' – ' + FANTASMA.l)
  g.append(h('div', { class: 'grupo-rot' }, h('span', null, 'La noche'), rotHora))
  const caja = h('div', { class: 'noche' })
  const fa = minNoche(FANTASMA.a), fl = minNoche(FANTASMA.l)
  const tramo = h('div', { class: 'noche-tramo' })
  caja.append(h('div', { class: 'noche-pista' }), h('div', { class: 'noche-fantasma', style: `left:${pct(fa)};width:${pct(fl - fa)}` }), tramo)
  const pintar = () => { tramo.style.left = pct(a); tramo.style.width = pct(l - a); tramo.hidden = !tocado && !arrastrado; rotHora.textContent = fmtHora(a + 1080) + ' – ' + fmtHora(l + 1080) }
  const guardarAsas = () => { anotar('horaAcostarse', fmtHora(a + 1080)); anotar('horaLevantarse', fmtHora(l + 1080)); S.pendienteHoras = S.datos.horasSueno == null; refrescar(); emitir({ tipo: 'toque' }) }
  const asa = (cual: 'a' | 'l') => {
    const b = h('button', { type: 'button', class: 'asa' + (tocado ? '' : ' fantasma'), role: 'slider', 'data-k': 'asa:' + cual, 'aria-label': cual === 'a' ? 'Me acosté a las' : 'Me levanté a las', 'aria-valuemin': '0', 'aria-valuemax': String(TOT) })
    const poner = () => { const v = cual === 'a' ? a : l; b.style.left = pct(v); b.setAttribute('aria-valuenow', String(v)); b.setAttribute('aria-valuetext', fmtHora(v + 1080)) }
    const fijar = (v: number) => { if (cual === 'a') a = clamp(v, 0, l - 30); else l = clamp(v, a + 30, TOT); poner(); pintar() }
    b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); arrastrado = true; b.classList.remove('fantasma') })
    b.addEventListener('pointermove', (e) => { if (!b.hasPointerCapture(e.pointerId)) return; const r = caja.getBoundingClientRect(); fijar(Math.round((((e.clientX - r.left) / r.width) * TOT) / 5) * 5); Onda.usuario(0.3) })
    b.addEventListener('pointerup', (e) => { if (b.hasPointerCapture(e.pointerId)) { b.releasePointerCapture(e.pointerId); guardarAsas() } })
    b.addEventListener('keydown', (e) => { const d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0; if (!d) return; e.preventDefault(); fijar((cual === 'a' ? a : l) + d * (e.shiftKey ? 30 : 5)); guardarAsas() })
    poner()
    return b
  }
  caja.append(asa('a'), asa('l')); pintar()
  g.append(caja, h('div', { class: 'noche-horas', 'aria-hidden': 'true' }, ...['18', '21', '00', '03', '06', '09', '12'].map((x) => h('span', null, x))))
  if (!tocado) g.append(chips([['Como la noche anterior', 'igual', 'fantasma']], () => { anotar('horaAcostarse', FANTASMA.a); anotar('horaLevantarse', FANTASMA.l); S.pendienteHoras = S.datos.horasSueno == null; refrescar(); emitir({ tipo: 'toque' }) }, null, 'noche-fantasma'))
}
/* La noche pide lo esencial: calidad y cansancio. El horario es opcional y va detrás de «Añadir la hora». */
export function controlNoche(): HTMLElement {
  const g = h('div', { class: 'grupo' })
  const conBarra = S.mostrarHoras || S.datos.horaAcostarse != null || S.datos.horaLevantarse != null
  if (conBarra) barraNoche(g)
  const ec = enCamaMin()
  const fila = h('div', { class: 'en-cama' })
  const fijarHoras = (v: number) => { S.pendienteHoras = false; tocar('horasSueno', v) }
  if (!conBarra) g.append(h('div', { class: 'grupo-rot' }, h('span', null, 'Horas de sueño · opcional')))
  if (ec != null) fila.append(h('span', { class: 'mono' }, 'En cama: ' + fmtDur(ec)))
  if (S.datos.horasSueno == null && ec != null) {
    if (S.pendienteHoras) { g.append(fila); return g }
    const unas = Math.round(ec / 30) / 2
    fila.append(chips([['Eso, unas ' + fmtNum(unas) + ' h', unas]], fijarHoras, null, 'unas'))
  } else {
    fila.append(stepper(S.datos.horasSueno == null ? null : S.datos.horasSueno, { min: 0, max: 14, paso: 0.5, inicio: ec != null ? Math.round(ec / 30) / 2 : 7, fmt: (v) => fmtNum(v) + ' h', rot: 'Horas de sueño', unidad: ' h' }, fijarHoras))
  }
  g.append(fila)
  if (!conBarra) g.append(chips([['Añadir la hora', 'horas']], () => { S.mostrarHoras = true; refrescar() }, null, 'anadir-hora'))
  return g
}
export function controlAclaracion(): HTMLElement | null {
  const partes: HTMLElement[] = []
  const ec = enCamaMin()
  if (S.pendienteHoras && ec != null) {
    const unas = Math.round(ec / 30) / 2
    partes.push(chips<number>([['Eso, unas ' + fmtNum(unas) + ' h', unas], ['Menos', unas - 1], ['Más', unas + 0.5]], (v) => { S.pendienteHoras = false; tocar('horasSueno', v) }, null, 'aclara-horas'))
  }
  for (const c of ['calidadSueno', 'cansancio', 'estres'] as Campo[]) if (S.dudas[c]) partes.push(chips<string>(S.dudas[c].opciones.map((o) => [ETQ[c][o], o]), (v) => tocar(c, v, S.fuentes[c] || 'texto', S.dudas[c] && S.dudas[c].cita), null, 'duda-' + c))
  if (!partes.length) return null
  return h('div', { class: 'grupo' }, h('div', { class: 'grupo-rot' }, h('span', null, 'Para no adivinar')), ...partes)
}

/* Editor de una nota en la firma: tocar una nota abre su mismo control */
type Bloque = () => Node | null | (Node | null | false)[]
export function abrirEditor(campo: Campo, refresco?: boolean): void {
  S.editando = campo
  const ed = $('#editor')
  ed.hidden = false
  if (!refresco) ed.textContent = ''
  const bloques: Partial<Record<Campo, Bloque>> = {
    horaAcostarse: controlNoche, horaLevantarse: controlNoche, horasSueno: controlNoche, calidadSueno: gCalidad, cansancio: gCansancio,
    entreno: controlEntreno, rendimiento: gRendimiento, motivacion: gGanas, dolor: controlDolor, hambreEscala: controlHambre,
    alimentacion: gAlimentacion, estres: gEstres, pasos: filaPasos, comentarios: filaComentarios,
  }
  const bloque = bloques[campo]
  morphHijos(ed, [h('div', { class: 'grupo-rot' }, h('span', null, 'Corregir · ' + rotulo(campo))),
    ...([] as (Node | null | false)[]).concat(bloque ? bloque() : []).filter((n): n is Node => !!n),
    h('div', { class: 'pie-controles' }, h('button', { type: 'button', class: 'seguir', 'data-k': 'hecho-editor', onclick: () => { ed.hidden = true; S.editando = null; ed.textContent = '' } }, 'Hecho'))])
  if (!refresco) { traerALaVista(ed, 'nearest'); const f = ed.querySelector<HTMLElement>('button:not(.seguir), [role=slider]'); if (f) f.focus({ preventScroll: true }) }
}
