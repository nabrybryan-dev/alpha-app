import { renderBienestar } from './bienestar'
import { Cab, Sala, SinSalto, compactar, enfocarControles, limpiarControles, montar, soltarFlip } from './cabecera'
import { conectada } from './conexion'
import { correrConversacion } from './conversacion'
import { Cosmos } from './cosmos'
import { EJEMPLO, HOY, ayer } from './datos'
import { $, $$, aviso, escalaX, h } from './dom'
import { borrarClave, guardar, raiz, reducido, tieneAnimate, tu } from './entorno'
import { mostrarDiaHecho } from './fases'
import { fijarFrase } from './frase'
import { DUR, EASE } from './movimiento'
import { Onda } from './onda'
import { Penta, Viajeras } from './penta'
import { Mic, detenerMic, entrarQuieta, renderSaltos } from './senales'
import { Dia, S, cancelar, guardarBorrador, hayDatos, renovarSesion, type Permisos } from './sesion'
import { correrCheckin } from './turnos'
import type { Geo } from './ondaEstado'

/**
 * La sala: el agujero de la portada viaja hasta su sitio.
 * Abrir (520 ms): el botón se hunde; un clon de la mini firma, montado a tamaño final, viaja por translate+scale con --ease-cajon hasta la
 * cabecera; Bienestar se desvanece sin deslizarse; el cielo no cambia de capa; a los 280 ms el clon y el lienzo se cruzan (blur 2 px).
 * Cerrar (360 ms): el mismo camino, más corto. Si se cierra a mitad de la entrada, todo se invierte desde el valor visible (Animation.reverse).
 */
const CLASE_BODY = 'praxis-sala-abierta'
export function soltarBody(): void { document.body.classList.remove(CLASE_BODY) }

export function limpiarSala(): void {
  Onda.reiniciar(); Penta.cerrar(); limpiarControles(); renderSaltos()
  soltarFlip()
  compactar(false, true); Cab.pendiente = false; Cab.ayer = false
  $('#penta').hidden = false; $('#muelle').hidden = false; $('#editor').hidden = true; $('#senal').hidden = true
  $('#frase').textContent = ''; $('#dijo').textContent = ''; $('#ayuda').textContent = ''; $('#ondaPie').textContent = ''; $('#srPiensa').textContent = ''
  $('#dicho').classList.remove('vacio', 'lee'); $('#dicho').removeAttribute('aria-busy'); $('#btnCompletar').hidden = true
}
export function reiniciarSesion(): void { cancelar(); borrarClave('borrador'); renovarSesion(); if (!$('#sala').hidden) cerrarSala(true); limpiarSala() }

function animar(el: Element, kf: Keyframe[], opt: KeyframeAnimationOptions): void { if (!tieneAnimate()) return; Sala.anims.push(el.animate(kf, opt)) }
function alAcabar(fn: () => void): void { void Promise.allSettled(Sala.anims.map((a) => a.finished)).then(fn) }
export function limpiarAnimsSala(): void {
  Sala.anims.forEach((a) => { try { a.cancel() } catch { /* nada */ } }); Sala.anims = []
  if (Sala.clon) { Sala.clon.remove(); Sala.clon = null }
  $('#miniFirma').classList.remove('viaja')
}
/* El clon del agujero: la mini firma montada a tamaño final (lado = 112 · Rh/14) para que se rasterice grande y termine nítida */
function clonDelAgujero(g: Geo) {
  const mini = $('#miniFirma'), lado = 112 * (g.Rh / 14)
  const clon = h('div', { class: 'viaje', 'aria-hidden': 'true' })
  /* La mini respira entre .93 y 1: el clon parte (o aterriza) exactamente en la escala que tenga en ese instante, y la mini se pausa mientras viaja */
  const gm = mini.querySelector('g.respira')
  const esc = gm ? escalaX(gm) : 1
  const svg = mini.cloneNode(true) as SVGElement
  for (const a of ['id', 'class', 'role', 'aria-label']) svg.removeAttribute(a)
  svg.querySelectorAll<SVGElement>('.respira').forEach((x) => { x.removeAttribute('class'); x.style.transformOrigin = '60px 60px' })
  clon.append(svg)
  Object.assign(clon.style, { left: g.cx - lado / 2 + 'px', top: g.cy - lado / 2 + 'px', width: lado + 'px', height: lado + 'px' })
  raiz().append(clon); Sala.clon = clon
  /* Lo que viaja es la materia del agujero (horizonte, fotones, disco). La firma blanca de la mini, ampliada ×3, no existe en el agujero grande:
     sale con la mini (o entra al aterrizar en ella). La continuidad de forma la lleva formaAyer en el borde del disco. */
  return { clon, esc, cuerpo: svg.querySelector(':scope > g'), firma: Array.from(svg.querySelectorAll('.trazo, .halo')) }
}
function miniVisible(): DOMRect | null { const r = $('#miniFirma').getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight ? r : null }
function ocultarApp(): void { const app = $('#app'); app.style.opacity = '0'; app.style.visibility = 'hidden' } // ya no se ve: opacidad 0, fuera del árbol de accesibilidad y de los cuadros
function finAbrir(): void {
  if (Sala.estado !== 'abriendo') return
  ocultarApp(); limpiarAnimsSala(); Sala.estado = 'abierta'
}
export function abrirSala(modo?: 'quieta' | 'demo', opt: { sinViaje?: boolean } = {}): void {
  const sala = $('#sala'), app = $('#app')
  limpiarAnimsSala(); clearTimeout(Sala.tAbrir); Sala.limpiar = false
  const mini = $('#miniFirma'), rm = miniVisible()
  sala.hidden = false; SinSalto.reiniciar()
  document.body.classList.add(CLASE_BODY); app.setAttribute('aria-hidden', 'true'); app.inert = true; app.style.visibility = ''; app.style.opacity = ''
  Cosmos.sala(true)
  soltarFlip()
  compactar(false, true) // la sala se abre con el agujero grande
  Onda.arrancar(); Penta.colocar()
  raiz().style.setProperty('--muelle-h', ($('#muelle').offsetHeight || 112) + 'px')
  const g = Onda.geometria(true)
  Sala.estado = 'abriendo'
  const soloFundido = modo === 'quieta' || !!Dia.hecho // la Quieta y «Ver mi día» no tienen el agujero grande de reposo: solo opacidad
  const viaje = !reducido() && tieneAnimate() && !opt.sinViaje && !soloFundido && !!rm && !!g
  if (opt.sinViaje) { ocultarApp(); Sala.estado = 'abierta' }
  else if (viaje && rm && g) {
    const { clon, esc, cuerpo, firma } = clonDelAgujero(g), f = g.Rh / 14
    mini.classList.add('viaja')
    const dx = rm.left + rm.width / 2 - g.cx, dy = rm.top + rm.height / 2 - g.cy
    animar(clon, [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(1 / f).toFixed(4)})` }, { transform: 'none' }], { duration: DUR.escena, easing: EASE.cajon, fill: 'both' }) // 0–520 ms: el agujero viaja
    if (cuerpo && Math.abs(esc - 1) > 0.004) animar(cuerpo, [{ transform: `scale(${esc.toFixed(4)})` }, { transform: 'scale(1)' }], { duration: DUR.escena, easing: EASE.cajon, fill: 'both' }) // sale con la escala que tenía la mini al respirar
    firma.forEach((el) => animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.toque, easing: EASE.salida, fill: 'both' })) // 0–160 ms: la firma blanca se queda en la mini
    animar(clon, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }], { delay: 280, duration: DUR.base, easing: EASE.salida, fill: 'both' }) // 280–520 ms: el relevo al lienzo
    animar($('#onda'), [{ opacity: 0, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0px)' }], { delay: 280, duration: DUR.base, easing: EASE.salida, fill: 'both' })
    animar(app, [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.base, easing: EASE.salida, fill: 'forwards' }) // 0–240 ms: Bienestar baja a 0, sin deslizarse
    animar($('#salaBarra'), [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { delay: 120, duration: DUR.base, easing: EASE.salida, fill: 'backwards' }) // 120–360: viene del borde de arriba
    animar($('#muelle'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { delay: 240, duration: DUR.base, easing: EASE.salida, fill: 'backwards' }) // 240–480: viene del borde de abajo
    /* El resto entra con opacidad cuando Bienestar ya bajó a 0 (sin doble exposición): «Respirar un minuto» a los 240 ms y las cinco órbitas desde los 440 ms, escalonadas cada 40 ms */
    animar($('#filaRespira'), [{ opacity: 0 }, { opacity: 1 }], { delay: DUR.base, duration: DUR.base, easing: EASE.salida, fill: 'backwards' })
    $$('#penta .linea').forEach((l, i) => animar(l, [{ opacity: 0 }, { opacity: 1 }], { delay: 440 + i * 40, duration: DUR.base, easing: EASE.salida, fill: 'backwards' }))
    alAcabar(finAbrir)
  } else if (tieneAnimate()) { // portada fuera de la pantalla, o movimiento reducido: solo opacidad
    const dur = reducido() ? DUR.toque : DUR.base
    animar(sala, [{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: EASE.salida, fill: 'backwards' })
    animar(app, [{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: EASE.salida, fill: 'forwards' })
    alAcabar(finAbrir)
  } else { ocultarApp(); Sala.estado = 'abierta' }
  setTimeout(() => { if (!sala.hidden && !sala.contains(document.activeElement)) sala.focus({ preventScroll: true }) }, 30) // la sala recibe el foco solo si nadie lo tomó: la Quieta lo pone en su primer párrafo
  const empezar = () => { if (Sala.estado === 'cerrando' || $('#sala').hidden) return; void (conectada() ? correrConversacion() : correrCheckin()) }
  if (modo === 'demo') return
  if (modo === 'quieta') { limpiarSala(); entrarQuieta('vida', null, true); return }
  if (Dia.hecho && Dia.hecho.riesgo) { entrarQuieta(Dia.hecho.riesgo, null, false); return }
  if (Dia.hecho) { mostrarDiaHecho(); return }
  if (S.quieta) { S.quieta = null; limpiarSala() }
  if (!$<HTMLInputElement>('#cConversacion').checked || !$<HTMLInputElement>('#cRiesgo').checked) { // nada viene marcado: la primera vez Praxis explica y la persona decide
    if (Dia.permisos == null) { limpiarSala(); mostrarBienvenida(); return }
    cerrarSala(true); aviso(tu('Praxis está apagada. Puedes encenderla en «Tus permisos».', 'Praxis está apagada. Puede encenderla en «Sus permisos».')); return
  }
  if (S.pausaDesde) { S.pausa += performance.now() - S.pausaDesde; S.pausaDesde = 0 }
  const dAyer = ayer()
  if (!hayDatos() && dAyer && !conectada()) { Onda.formaAyer(dAyer); Cab.ayer = true } // el agujero arranca con el día de ayer y lo suelta al acabar la primera frase
  if (viaje) setTimeout(() => { if (Sala.estado === 'abriendo') Onda.anticipa() }, 280) // 280–400 ms: el disco toma aire antes de la primera frase
  Sala.tAbrir = window.setTimeout(empezar, viaje ? 380 : 0) // ≈ 400 ms: empieza la primera frase, cuando el agujero ya casi llegó
}
function finCierre(): void {
  if (Sala.estado === 'cerrada') return
  limpiarAnimsSala()
  const app = $('#app')
  app.style.visibility = ''; app.style.opacity = ''; app.removeAttribute('aria-hidden'); app.inert = false
  $('#sala').hidden = true; soltarBody(); Cosmos.sala(false)
  Onda.detener()
  if (Sala.limpiar) { Sala.limpiar = false; limpiarSala() }
  Sala.estado = 'cerrada'
  if (Sala.avisoBorrador) { Sala.avisoBorrador = false; aviso('Borrador guardado en este teléfono. Nada llega a Bryan sin LISTO.') }
  if (Sala.enfocar) { Sala.enfocar = false; $('#btnAbrir').focus({ preventScroll: true }) }
}
export function cerrarSala(silencioso?: boolean): void {
  const sala = $('#sala')
  if (sala.hidden || Sala.estado === 'cerrando') return
  const enApertura = Sala.estado === 'abriendo'
  const quedaba = !S.listo && !S.quieta && hayDatos()
  if (Mic.activo) detenerMic(false)
  cancelar(); clearTimeout(Sala.tAbrir)
  if (!S.pausaDesde && S.t0) S.pausaDesde = performance.now()
  S.cuidado = null; Viajeras.limpiar(); cerrarMenuMas(); Cab.pendiente = false
  Sala.limpiar = false
  if (S.quieta && S.quieta.demo) { S.quieta = null; Sala.limpiar = true }
  if (S.turno === 'bienvenida' || S.turno === 'demo') { S.turno = null; Sala.limpiar = true }
  if (S.listo) { renovarSesion(); Sala.limpiar = true }
  if (quedaba) { guardarBorrador(); if (!silencioso) Sala.avisoBorrador = true }
  Sala.enfocar = !silencioso
  renderBienestar()
  const app = $('#app')
  if (silencioso || !tieneAnimate()) { Sala.estado = 'cerrando'; finCierre(); return }
  if (enApertura && Sala.anims.length) { // se cierra a mitad de la entrada: la vuelta parte del valor visible
    Sala.estado = 'cerrando'
    Sala.anims.forEach((a) => { try { a.reverse() } catch { /* nada */ } })
    alAcabar(finCierre)
    return
  }
  Sala.estado = 'cerrando'
  const mini = $('#miniFirma'), rm = miniVisible(), g = Onda.geometria()
  app.style.visibility = 'visible'; app.removeAttribute('aria-hidden'); app.inert = false
  if (reducido() || !rm || !g) { // solo opacidad
    animar(sala, [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.toque, easing: EASE.salida, fill: 'forwards' })
    animar(app, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR.toque, easing: EASE.salida, fill: 'both' })
    alAcabar(finCierre)
    return
  }
  const { clon, esc, cuerpo, firma } = clonDelAgujero(g), f = g.Rh / 14
  mini.classList.add('viaja')
  const dx = rm.left + rm.width / 2 - g.cx, dy = rm.top + rm.height / 2 - g.cy
  animar(clon, [{ transform: 'none' }, { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(1 / f).toFixed(4)})` }], { duration: DUR.panel, easing: EASE.cajon, fill: 'both' }) // el mismo camino, más corto
  if (cuerpo && Math.abs(esc - 1) > 0.004) animar(cuerpo, [{ transform: 'scale(1)' }, { transform: `scale(${esc.toFixed(4)})` }], { duration: DUR.panel, easing: EASE.cajon, fill: 'both' }) // aterriza en la escala en que la mini quedó pausada: sin salto
  firma.forEach((el) => animar(el, [{ opacity: 0 }, { opacity: 1 }], { delay: DUR.panel - DUR.toque, duration: DUR.toque, easing: EASE.salida, fill: 'both' })) // la firma vuelve en los últimos 160 ms
  animar(clon, [{ opacity: 0, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: DUR.toque, easing: EASE.salida, fill: 'both' })
  animar($('#onda'), [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }], { duration: DUR.toque, easing: EASE.salida, fill: 'forwards' })
  ;['#salaResto', '#salaBarra', '#muelle', '#filaRespira'].forEach((q) => animar($(q), [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.toque, easing: EASE.salida, fill: 'forwards' })) // 0–160 ms: salen los controles, el muelle y la barra
  animar(app, [{ opacity: 0 }, { opacity: 1 }], { delay: 120, duration: DUR.base, easing: EASE.salida, fill: 'both' }) // 120–360 ms: Bienestar sube
  alAcabar(finCierre)
}

/* ——— El menú «Más» de la barra: Respirar, Formulario y Rápido ——— */
export function cerrarMenuMas(): void { const m = $('#menuMas'); if (!m || m.hidden) return; m.hidden = true; $('#btnMas').setAttribute('aria-expanded', 'false') }
export function alternarMenuMas(): void {
  const m = $('#menuMas'), abrir = m.hidden
  m.hidden = !abrir; $('#btnMas').setAttribute('aria-expanded', String(abrir))
  if (abrir) { const b = m.querySelector('button'); if (b) b.focus({ preventScroll: true }) }
}

/* ——— Bienvenida: la primera vez Praxis explica y la persona decide. Nada viene marcado de antemano. ——— */
export function mostrarConsentimiento(): void {
  const p = Dia.permisos
  const cuando = EJEMPLO ? '29 de septiembre de 2026' : String(p && p.fecha)
  $('#consentFecha').textContent = p && p.fecha ? tu('Aceptaste el ' + cuando + ' (versión 1 del texto). Puedes cambiar cada permiso aquí.', 'Aceptó el ' + cuando + ' (versión 1 del texto). Puede cambiar cada permiso aquí.') : tu('Todavía no has aceptado. La primera vez que abras Praxis, te explica todo y tú decides.', 'Todavía no ha aceptado. La primera vez que abra Praxis, le explica todo y usted decide.')
}
export function guardarPermisos(): void {
  const p: Permisos = {}
  ;['cConversacion', 'cVoz', 'cRiesgo', 'cSonido'].forEach((k) => { p[k] = $<HTMLInputElement>('#' + k).checked })
  if (p.cConversacion && p.cRiesgo) { p.fecha = (Dia.permisos && Dia.permisos.fecha) || HOY.fecha; p.version = 'v1' }
  Dia.permisos = p; guardar('permisos', p); mostrarConsentimiento()
}
function mostrarBienvenida(): void {
  S.turno = 'bienvenida'; compactar(false)
  $('#penta').hidden = true; $('#muelle').hidden = true
  fijarFrase('Antes de empezar, tres cosas claras.')
  montar(() => h('div', { class: 'bienvenida' },
    h('ol', null,
      h('li', null, h('b', null, 'Quién soy. '), 'Soy Praxis, la voz sintética de Alpha: una inteligencia artificial, no una persona. No diagnostico ni hago terapia.'),
      conectada() ? h('li', null, h('b', null, 'Qué se guarda. '), tu('Leo tu plan y tus últimos check-ins para contestarte; no los cambio. De lo que me cuentes, solo se guarda lo que confirmes con un toque en «Guardar». Lo que escribes para anotar viaja a un servicio de inteligencia artificial; lo que suene a riesgo o a salud no sale de este teléfono.', 'Leo su plan y sus últimos check-ins para contestarle; no los cambio. De lo que me cuente, solo se guarda lo que confirme con un toque en «Guardar». Lo que escribe para anotar viaja a un servicio de inteligencia artificial; lo que suene a riesgo o a salud no sale de este teléfono.')) :
      h('li', null, h('b', null, 'Qué se guarda. '), tu('Solo lo que toques o escribas, y solo cuando toques LISTO. Lo que no digas queda en blanco. El audio nunca se guarda. Al aceptar, autorizas que Alpha trate esos datos de salud para tu plan de hábitos; lo puedes cambiar en «Tus permisos».', 'Solo lo que toque o escriba, y solo cuando toque LISTO. Lo que no diga queda en blanco. El audio nunca se guarda. Al aceptar, autoriza que Alpha trate esos datos de salud para su plan de hábitos; lo puede cambiar en «Sus permisos».')),
      conectada() ? h('li', null, h('b', null, 'Si hay riesgo. '), tu('Si algo que cuentas parece una señal de riesgo, me quedo quieta y te doy números de ayuda. Desde aquí todavía no se le avisa a nadie: si es urgente, llama al 123.', 'Si algo que cuenta parece una señal de riesgo, me quedo quieta y le doy números de ayuda. Desde aquí todavía no se le avisa a nadie: si es urgente, llame al 123.')) :
      h('li', null, h('b', null, 'Si hay riesgo. '), tu('Si algo que cuentas parece una señal de riesgo, me quedo quieta, te doy números de ayuda y Bryan recibe tu frase. Bryan no es psicólogo y puede tardar en leer: si es urgente, llama al 123.', 'Si algo que cuenta parece una señal de riesgo, me quedo quieta, le doy números de ayuda y Bryan recibe su frase. Bryan no es psicólogo y puede tardar en leer: si es urgente, llame al 123.'))),
    h('button', { class: 'btn-plata', type: 'button', 'data-k': 'acepto', onclick: aceptarBienvenida }, 'Acepto y empiezo'),
    h('button', { class: 'enlace enlace-plata', type: 'button', onclick: () => cerrarSala() }, 'Ahora no')))
  enfocarControles()
}
function aceptarBienvenida(): void {
  $<HTMLInputElement>('#cConversacion').checked = true; $<HTMLInputElement>('#cRiesgo').checked = true
  guardarPermisos(); renderBienestar()
  limpiarControles(); $('#penta').hidden = false; $('#muelle').hidden = false; $('#frase').textContent = ''
  void (conectada() ? correrConversacion() : correrCheckin())
}
