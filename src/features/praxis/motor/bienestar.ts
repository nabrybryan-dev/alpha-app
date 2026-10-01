import { FIRMAS_PREVIAS, HOY, SEMANA, TXT, USUARIO, ayer, type DatosDia } from './datos'
import { $, $$, aviso, copiar, h, sv } from './dom'
import { borrarClave, escuchar, guardar, leer, tu } from './entorno'
import { anilloPath, firmaDelDia, hash01, puntoAnillo, rendimientoDicho, resumenFirma } from './firma'
import { abrirSala, guardarPermisos, mostrarConsentimiento, reiniciarSesion } from './sala'
import { Dia, E, aplicarEscenario, fijarHecho, type Escenario } from './sesion'
import { fmtMiles, fmtNum, listaY, numPalabra, sesion } from './texto'

/**
 * La portada de ejemplo: la tarjeta de Praxis, la semana en órbita y el mes como galaxia.
 * Todo sale de `datos.ts`: nada de esto es de un asesorado.
 */

/* Un agujero negro pequeño: anillo de fotones y horizonte */
function agujeroSvg(g: Element, cx: number, cy: number, r: number): void { g.append(sv('circle', { cx, cy, r: (r * 1.14).toFixed(1), class: 'fotones' }), sv('circle', { cx, cy, r, class: 'horizonte' })) }

function preguntasDeHoy(): string[] {
  const l: string[] = []
  if (E.idea === 'si') l.push('la idea de ayer')
  l.push('la noche', 'el entreno', 'el cuerpo', 'la comida')
  return l
}
function renderMini(): void {
  const svg = $('#miniFirma')
  svg.textContent = ''
  const hecho = Dia.hecho
  const riesgo = !!(hecho && hecho.riesgo)
  const hoy = !riesgo && hecho ? hecho.datos : null
  const d = hoy || ayer()
  if (riesgo) { svg.append(sv('circle', { cx: 60, cy: 60, r: 16, class: 'horizonte' })); svg.setAttribute('aria-label', 'Hoy la conversación se detuvo.') } // quieta: sin anillo y sin respiración
  else {
    const f = firmaDelDia(d, USUARIO, hoy ? HOY.fecha : SEMANA[5].fecha, 120)
    const g = sv('g', { class: 'respira' })
    const dd = anilloPath(f.pts, 60, 60, 40, 9)
    g.append(sv('ellipse', { cx: 60, cy: 60, rx: 30, ry: 8, class: 'disco' }), sv('path', { d: dd, class: 'halo' }), sv('path', { d: dd, class: 'trazo' }))
    agujeroSvg(g, 60, 60, 15)
    svg.append(g)
    svg.setAttribute('aria-label', resumenFirma(d, hoy ? 'martes (hoy)' : 'lunes'))
  }
  $('#miniRotulo').textContent = hoy || riesgo ? 'HOY · MAR 29' : tu('TU FIRMA DE AYER · LUN 28', 'SU FIRMA DE AYER · LUN 28')
  $('#bryanVio').hidden = !!(hoy || riesgo)
  const idea = $('#tarjetaIdea'), btnAbrir = $<HTMLButtonElement>('#btnAbrir')
  if (hecho && (hoy || riesgo)) {
    $('#tarjetaTxt').textContent = riesgo ? tu('Hoy la conversación se detuvo. Bryan ya recibió tu frase.', 'Hoy la conversación se detuvo. Bryan ya recibió su frase.') : 'Listo por hoy. Bryan lo va a revisar.'
    idea.hidden = riesgo || !hecho.idea
    if (!idea.hidden) { idea.textContent = ''; idea.append(h('b', null, tu('Tu idea de hoy', 'Su idea de hoy')), hecho.idea || '') }
    btnAbrir.textContent = riesgo ? 'Abrir' : 'Ver mi día'
    $('#btnRepetir').hidden = false
  } else {
    const q = preguntasDeHoy()
    $('#tarjetaTxt').textContent = 'Hoy son ' + numPalabra(q.length) + ': ' + listaY(q) + tu('. Después, tu firma del día.', '. Después, su firma del día.')
    idea.hidden = true; btnAbrir.textContent = 'Hablar con Praxis'; $('#btnRepetir').hidden = true
  }
  $('#contador').textContent = FIRMAS_PREVIAS + (hoy ? 1 : 0) + ' firmas en total'
  $('#contadorMes').textContent = mesDeEjemplo().filter((x) => x.d).length + ' firmas este mes'
  const activo = $<HTMLInputElement>('#cRiesgo').checked && $<HTMLInputElement>('#cConversacion').checked
  const sinDecidir = Dia.permisos == null
  btnAbrir.disabled = !activo && !sinDecidir
  if (!activo && !sinDecidir) $('#tarjetaTxt').textContent = tu('Praxis necesita tus permisos de conversación y de aviso por riesgo. El formulario sigue igual.', 'Praxis necesita sus permisos de conversación y de aviso por riesgo. El formulario sigue igual.')
}

/* ——— La semana: siete astros en una órbita. Cada día, un agujero pequeño con su firma como anillo ——— */
let compasSel = -1
function datosDelDia(i: number): DatosDia | null { const dia = SEMANA[i]; if (dia.hoy) return Dia.hecho && !Dia.hecho.riesgo ? Dia.hecho.datos : null; return dia.d }
function anchoDe(el: Element | null, def: number): number { const w = el && el.clientWidth; return Math.max(280, Math.min(520, Math.round(w || def))) }
export function renderPartitura(): void {
  const box = $('#partitura')
  box.textContent = ''
  /* Maquetación propia al ancho real (≈ 358 px en un móvil): el astro mide lo que se ve, los rótulos son texto del DOM a 12 px */
  const W = anchoDe(box, 358), D = 52, C = D / 2, R = 18, AMP = 4
  const desnivel = (x: number) => 12 * Math.pow((x - W / 2) / (W / 2), 2) // los extremos de la órbita caen 12 px
  const curva = (f: (x: number) => number, desde: number, hasta: number) => { let dd = ''; for (let x = desde; x <= hasta; x += 8) dd += (x === desde ? 'M' : 'L') + x + ' ' + f(x).toFixed(1); return dd }
  const orb = sv('svg', { class: 'semana-orb', viewBox: `0 0 ${W} ${D + 16}`, height: D + 16, 'aria-hidden': 'true' })
  orb.append(sv('path', { d: curva((x) => 8 + 4 * Math.pow((x - W / 2) / (W / 2), 2), 26, W - 26), class: 'orbita-lejana' }), sv('path', { d: curva((x) => C + desnivel(x), 4, W - 4), class: 'orbita' }))
  const grid = h('div', { class: 'semana-dias' })
  const botones: HTMLElement[] = []
  SEMANA.forEach((dia, j) => {
    const cx = (j + 0.5) * (W / 7), d = datosDelDia(j)
    const svg = sv('svg', { viewBox: `0 0 ${D} ${D}`, 'aria-hidden': 'true' })
    svg.append(sv('circle', { cx: C, cy: C, r: 25, class: 'sel-halo' }))
    if (d) {
      const f = firmaDelDia(d, USUARIO, dia.fecha, 70), dd = anilloPath(f.pts, C, C, R, AMP)
      svg.append(sv('ellipse', { cx: C, cy: C, rx: 13, ry: 3.6, class: 'disco-mini' }), sv('path', { d: dd, class: 'firma-halo' }), sv('path', { d: dd, class: 'firma-tinta' }))
      agujeroSvg(svg, C, C, 6.6)
      if (f.ambar) { const [ax, ay] = puntoAnillo(f.pts, 0.58, C, C, R, AMP); svg.append(sv('circle', { cx: ax.toFixed(1), cy: ay.toFixed(1), r: 3.2, class: 'punto-ambar' })) }
    } else if (dia.hoy) svg.append(sv('circle', { cx: C, cy: C, r: R, class: 'firma-hoy' }))
    else svg.append(sv('circle', { cx: C, cy: C, r: 8, class: 'silencio' })) // un hueco oscuro, sin contarlo ni resaltarlo
    const b = h('button', { type: 'button', class: 'dia', 'aria-pressed': String(compasSel === j), style: 'margin-top:' + desnivel(cx).toFixed(1) + 'px',
      'aria-label': resumenFirma(d, dia.dia + (dia.hoy ? ' (hoy)' : '')) + tu(' Toca para ver el día.', ' Toque para ver el día.') },
      svg, h('span', { class: 'dia-rot' }, dia.hoy ? 'HOY' : dia.rot.split(' ')[0]), h('span', { class: 'dia-num' }, dia.rot.split(' ')[1]),
      h('span', { class: 'dia-com', 'aria-hidden': 'true' }, d && d.comentarios ? '«»' : ''))
    b.addEventListener('click', () => { compasSel = compasSel === j ? -1 : j; botones.forEach((x, i) => x.setAttribute('aria-pressed', String(i === compasSel))); renderDetalle() })
    botones.push(b); grid.append(b)
  })
  box.append(orb, grid)
}
function renderDetalle(): void {
  const box = $('#compasDetalle')
  box.textContent = ''
  if (compasSel < 0) { box.append(h('p', { class: 'pie-nota' }, tu('Toca un astro para ver ese día; es solo de lectura.', 'Toque un astro para ver ese día; es solo de lectura.'))); return }
  const dia = SEMANA[compasSel], d = datosDelDia(compasSel)
  box.append(h('div', { class: 'detalle-cab' }, h('span', null, dia.hoy ? 'HOY · MAR 29' : dia.rot), h('span', null, 'SOLO LECTURA')))
  if (!d) { box.append(h('p', { class: 'pie-nota' }, dia.hoy ? (Dia.hecho && Dia.hecho.riesgo ? 'Hoy la conversación se detuvo.' : tu('Tu check-in de hoy todavía está aquí, cuando lo quieras.', 'Su check-in de hoy todavía está aquí, cuando lo quiera.')) : 'Sin registro. Un hueco oscuro también es parte del cielo.')); return }
  const junta = (p: (string | null | undefined | false)[]) => p.filter(Boolean).join(' · ')
  const filas: [string, string][] = [
    ['Sueño', junta([d.horasSueno != null ? fmtNum(d.horasSueno) + ' h' : null, d.calidadSueno ? TXT.sue[d.calidadSueno] : null, d.horaAcostarse && d.horaLevantarse ? d.horaAcostarse + '–' + d.horaLevantarse : null])],
    ['Energía', junta([d.cansancio ? TXT.can[d.cansancio] : null, d.motivacion ? TXT.gan[d.motivacion] : null])],
    ['Cuerpo', junta([d.entreno ? sesion(d.entreno) + (d.rendimiento ? ', ' + rendimientoDicho(d) : '') : null, d.dolor === 0 ? 'nada duele' : d.dolor != null ? 'dolor ' + d.dolor + (d.dolorDonde ? ' · ' + d.dolorDonde : '') : null, d.pasos != null ? fmtMiles(d.pasos) + ' pasos' : null])],
    ['Comida', junta([d.hambreEscala != null ? 'hambre ' + d.hambreEscala : null, d.alimentacion ? TXT.com[d.alimentacion] : null])],
    ['Mente', d.estres ? TXT.est[d.estres] : ''],
  ]
  if (d.comentarios) filas.push(['Letra', '«' + d.comentarios + '»'])
  const idea = dia.hoy ? Dia.hecho && Dia.hecho.idea : dia.idea
  if (idea) filas.push(['Idea', idea])
  const dl = h('dl')
  filas.forEach(([a, b]) => { if (b) dl.append(h('dt', null, a), h('dd', null, b)) })
  box.append(dl)
}

/* ——— El mes: la galaxia de firmas ——— */
interface DiaMes { fecha: string; d: DatosDia | null | undefined; hoy?: boolean }
function mesDeEjemplo(): DiaMes[] {
  const dias: DiaMes[] = []
  const base = new Date(Date.UTC(2026, 7, 31))
  const silencios = new Set([3, 9, 16])
  for (let i = 0; i < 23; i++) {
    const f = new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10)
    if (silencios.has(i)) { dias.push({ fecha: f, d: null }); continue }
    const r = (k: string) => hash01(f + k)
    const pick = <T,>(k: string, arr: T[]): T => arr[Math.floor(r(k) * arr.length) % arr.length]
    dias.push({ fecha: f, d: {
      horasSueno: 5.5 + Math.round(r('h') * 6) / 2, horaAcostarse: pick('a', ['23:20', '23:40', '23:50', '00:10', '00:30']),
      calidadSueno: pick('c', ['BUENA', 'BUENA', 'REGULAR', 'MALA']), cansancio: pick('n', ['POCO', 'REGULAR', 'REGULAR', 'MUCHO']),
      entreno: pick('e', ['UPPER A', 'LEG A', 'UPPER B', 'LEG B', 'Descansé']), rendimiento: pick('r', ['BUENA', 'REGULAR', 'BUENA']),
      motivacion: pick('m', ['POCO', 'REGULAR', 'MUCHO']), dolor: r('d') > 0.85 ? 2 : 0, hambreEscala: 2 + Math.floor(r('g') * 7),
      alimentacion: pick('l', ['BUENA', 'REGULAR', 'BUENA']), estres: pick('s', ['POCO', 'REGULAR', 'MUCHO']), pasos: 5000 + Math.floor(r('p') * 9000),
    } })
  }
  SEMANA.forEach((s) => dias.push({ fecha: s.fecha, d: s.hoy ? (Dia.hecho && !Dia.hecho.riesgo ? Dia.hecho.datos : undefined) : s.d, hoy: !!s.hoy }))
  return dias.filter((x) => x.d !== undefined)
}
/** El mes como galaxia: dos brazos en espiral, del día más viejo (núcleo) al más reciente (borde). */
export function renderCordillera(): void {
  const svg = $('#cordillera')
  svg.textContent = ''
  const dias = mesDeEjemplo()
  const n = dias.length, W = anchoDe(svg.parentElement, 358), Hh = Math.round(W * 0.66), cx = W / 2, cy = Hh / 2, e = 0.55, rMin = 34, rMax = W / 2 - 22
  svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`)
  const defs = sv('defs'), gr = sv('radialGradient', { id: 'nucleoGal' })
  ;[['0', 'gal-s0'], ['0.35', 'gal-s1'], ['1', 'gal-s2']].forEach(([o, c]) => gr.append(sv('stop', { offset: o, class: c }))) // stop-color en CSS (--gal-*): cambia con el tema
  defs.append(gr); svg.append(defs)
  svg.append(sv('ellipse', { cx, cy, rx: rMax * 0.42, ry: rMax * 0.42 * e * 1.2, fill: 'url(#nucleoGal)' }))
  const pos = (u: number, brazo: number): [number, number] => { const th = 0.5 + brazo * Math.PI + u * Math.PI * 2.9, r = rMin + u * (rMax - rMin); return [cx + r * Math.cos(th), cy + r * Math.sin(th) * e] }
  const trazoBrazo = (brazo: number) => { let dd = ''; for (let i = 0; i <= 120; i++) { const [x, y] = pos((i / 120) * 1.02, brazo); dd += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) } return dd }
  svg.append(sv('path', { d: trazoBrazo(0), class: 'brazo' }), sv('path', { d: trazoBrazo(1), class: 'brazo' }), sv('path', { d: trazoBrazo(0), class: 'brazo-fino' }), sv('path', { d: trazoBrazo(1), class: 'brazo-fino' }))
  dias.forEach((dia, k) => {
    const brazo = k % 2, i = Math.floor(k / 2), m = Math.ceil((n - brazo) / 2), u = m > 1 ? i / (m - 1) : 1
    const [x, y] = pos(u, brazo), R = 6 + 8 * u // el anillo más chico mide 6 px de radio
    if (!dia.d) { svg.append(sv('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (R * 0.7).toFixed(1), class: 'dia-hueco' })); return }
    const reciente = k === n - 1, edad = n > 1 ? k / (n - 1) : 1
    const f = firmaDelDia(dia.d, USUARIO, dia.fecha, 48)
    if (reciente) svg.append(sv('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (R * 1.5).toFixed(1), class: 'dia-halo' }))
    svg.append(sv('path', { d: anilloPath(f.pts, x, y, R, R * 0.28), class: 'dia-anillo ' + (reciente ? 'reciente' : edad < 0.34 ? 'e0' : edad < 0.67 ? 'e1' : 'e2') + (dia.hoy ? ' hoy' : '') }), sv('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (R * 0.35).toFixed(1), class: 'dia-nucleo' }))
  })
  const lista = $('#galaxiaLista')
  lista.textContent = ''
  lista.append(h('li', null, tu('Tu mes: ', 'Su mes: ') + dias.filter((x) => x.d).length + ' de 30 días con firma.'))
  dias.forEach((dia) => lista.append(h('li', null, dia.fecha + ': ' + (dia.d ? resumenFirma(dia.d, dia.fecha) : 'sin firma.'))))
}
export function renderBienestar(): void { renderMini(); renderPartitura(); renderDetalle(); renderCordillera() }

/* ——— Escenario, preferencias, permisos ——— */
function renderEscenario(): void {
  aplicarEscenario()
  $$('[data-esc]').forEach((b) => b.setAttribute('aria-pressed', String(E[b.dataset.esc as keyof Escenario] === b.dataset.v)))
  $('.bien-top .fecha').textContent = E.franja === 'manana' ? 'MARTES 29 SEP · 7:10 A. M.' : 'MARTES 29 SEP · 8:40 P. M.'
  $('#tarjetaTit').textContent = E.franja === 'manana' ? tu('¿Cómo amaneciste?', '¿Cómo amaneció?') : tu('¿Cómo estuvo tu día?', '¿Cómo estuvo su día?')
}
const PERMISOS = ['cConversacion', 'cVoz', 'cRiesgo', 'cSonido']
export function initBienestar(): void {
  compasSel = -1
  $$('[data-esc]').forEach((b) => escuchar(b, 'click', () => {
    E[b.dataset.esc as keyof Escenario] = b.dataset.v || ''; guardar('escenario', E); renderEscenario(); renderBienestar()
    if (!Dia.hecho) { reiniciarSesion(); aviso('Escenario cambiado. La conversación de ejemplo empieza de nuevo.') }
    else aviso(tu('Toca «Repetir el ejemplo» para ver este escenario.', 'Toque «Repetir el ejemplo» para ver este escenario.'))
  }))
  $$('[data-copiar]').forEach((b) => escuchar(b, 'click', () => void copiar(b.dataset.copiar || '', b)))
  const p = Dia.permisos
  PERMISOS.forEach((id) => { $<HTMLInputElement>('#' + id).checked = !!(p && p[id]) })
  PERMISOS.forEach((id) => escuchar($('#' + id), 'change', () => {
    guardarPermisos(); renderMini()
    if (id === 'cRiesgo' && !$<HTMLInputElement>('#cRiesgo').checked) aviso('Praxis queda apagada. El formulario sigue igual.')
  }))
  mostrarConsentimiento()
  const setForm = (abierto: boolean) => { $('#formPlegado').hidden = !abierto; $('#btnPrefieroForm').setAttribute('aria-expanded', String(abierto)); guardar('prefiereForm', abierto) }
  setForm(!!leer('prefiereForm', false))
  escuchar($('#btnPrefieroForm'), 'click', () => setForm($('#formPlegado').hidden))
  escuchar($('#btnVolverPraxis'), 'click', () => { setForm(false); $('#btnAbrir').focus() })
  escuchar($('#btnBorrarBorrador'), 'click', () => { borrarClave('borrador'); if (!Dia.hecho) reiniciarSesion(); aviso('Se borró el borrador de este teléfono.') })
  escuchar($('#btnRepetir'), 'click', () => { fijarHecho(null); borrarClave('borrador'); borrarClave('notaFecha'); borrarClave('presentada'); reiniciarSesion(); compasSel = -1; renderBienestar(); aviso(tu('Ejemplo reiniciado. Tu check-in de hoy vuelve a estar aquí.', 'Ejemplo reiniciado. Su check-in de hoy vuelve a estar aquí.')) })
  escuchar($('#btnDemoQuieta'), 'click', () => abrirSala('quieta'))
  renderEscenario()
}
