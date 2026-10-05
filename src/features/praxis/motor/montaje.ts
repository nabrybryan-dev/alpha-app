import { initBienestar, renderBienestar, renderCordillera, renderPartitura } from './bienestar'
import { Barra, conectarBarra } from './barra'
import { Anim, Cab, Sala, SinSalto, velarLuego } from './cabecera'
import { Cosmos } from './cosmos'
import { conectada, fijarConexion, type ConexionPraxis } from './conexion'
import { HOY, fijarFuente, fuenteDeEjemplo } from './datos'
import { Demo } from './demo'
import { $, aviso, callarAviso, traerALaVista } from './dom'
import { alDesmontar, escuchaMQ, escuchar, fijarEntorno, fijarMovSuave, guardar, leer, limpiarEntorno, movSuave, mq, tu, type Trato } from './entorno'
import { Escena, Tema } from './escena'
import { modoRapido } from './fases'
import { fuenteReal } from './fuenteReal'
import { conectarHablar } from './hablar'
import { Onda } from './onda'
import { Penta, Viajeras } from './penta'
import { respirar } from './respirar'
import { abrirSala, alternarMenuMas, cerrarMenuMas, cerrarSala, limpiarAnimsSala, soltarBody } from './sala'
import { Mic, detenerMic, enviarTexto, iniciarMic, renderSaltos } from './senales'
import { Dia, S, cancelar, cargarEstado, cortarDecir } from './sesion'
import { Voz, cerrarEco, dormirEco } from './voz'

/**
 * Montar y desmontar la escena de Praxis dentro de la app.
 *
 * La maqueta arrancaba una vez y vivía hasta cerrar la pestaña. Aquí la ruta se entra y se
 * sale: `montarPraxis` deja todo como recién abierto y lo que devuelve lo suelta todo —los
 * dos bucles de cuadros, la voz, el audio, los temporizadores de la demostración y cada
 * oyente colgado de `window` o `document`—.
 */
export interface OpcionesPraxis {
  trato: Trato
  /** Con conexión, la escena usa los datos y el cerebro reales. Sin ella, es la de ejemplo (solo pruebas). */
  conexion?: ConexionPraxis | null
}
export interface PraxisMontada { desmontar: () => void; alCambiarTema: () => void }

type TemaPropio = '' | 'dark' | 'light'
/* El tema de la demostración: «sistema» (el de la app), oscuro o claro. ?tema=claro|oscuro también vale. */
function fijarTema(raiz: HTMLElement, valor: TemaPropio, guardarlo = true): void {
  if (valor === 'light') raiz.setAttribute('data-tema', 'claro'); else if (valor === 'dark') raiz.setAttribute('data-tema', 'oscuro'); else raiz.removeAttribute('data-tema')
  const sel = $<HTMLSelectElement>('#temaSel')
  if (sel.value !== valor) sel.value = valor
  if (guardarlo) guardar('tema', valor)
}
function temaInicial(): TemaPropio {
  const q = (new URLSearchParams(location.search).get('tema') || '').toLowerCase()
  const deUrl = ({ claro: 'light', light: 'light', oscuro: 'dark', dark: 'dark', sistema: '' } as Record<string, TemaPropio>)[q]
  return deUrl != null ? deUrl : leer<TemaPropio>('tema', '')
}
function aplicarTema(): void { Tema.leer(); Cosmos.tema(); Onda.tema() }

export function montarPraxis(raiz: HTMLElement, { trato, conexion = null }: OpcionesPraxis): PraxisMontada {
  limpiarEntorno() // por si quedó algo de un montaje anterior
  fijarEntorno(raiz, trato, conexion ? conexion.usuarioId : null)
  fijarConexion(conexion)
  fijarFuente(conexion ? fuenteReal(conexion.leer(), conexion.usuarioId, conexion.hoy) : fuenteDeEjemplo())
  Escena.reiniciar()
  if (conexion) $('#salaFecha').textContent = HOY.corto
  Object.assign(Sala, { estado: 'cerrada', anims: [], clon: null, tAbrir: 0, limpiar: false, avisoBorrador: false, enfocar: false })
  Anim.flip = null; Anim.desliz = null; Cab.pendiente = false; Cab.ayer = false; Penta.abierto = false
  Voz.activa = false; Voz.esperando = false; Mic.activo = false
  cargarEstado()
  initBienestar()
  fijarTema(raiz, temaInicial(), false); Tema.leer()
  Cosmos.iniciar($<HTMLCanvasElement>('#cosmos'))
  Onda.iniciar($<HTMLCanvasElement>('#onda')); Onda.tema()
  Onda.centro(!!conexion) // conectada, el agujero va en el centro y lo más grande que cabe (Bryan, 2-oct)
  escuchar(window, 'resize', () => Onda.redimensionar())
  escuchar($('#temaSel'), 'change', (e) => { fijarTema(raiz, (e.target as HTMLSelectElement).value as TemaPropio); aplicarTema() })
  Onda.alCambiarQuien((q) => { const r = $('#ondaRotulo'); r.textContent = q === 'praxis' ? 'PRAXIS' : q === 'persona' ? tu('TE ESCUCHO', 'LE ESCUCHO') : ''; r.classList.toggle('on', !!q) })
  renderBienestar(); renderSaltos(); Penta.render()
  if (Dia.avisoCaduco) aviso(Dia.avisoCaduco, 5000)
  escuchaMQ(mq('(prefers-reduced-motion: reduce)'), () => { Onda.despertar(); Cosmos.cambio() })
  escuchaMQ(mq('(prefers-reduced-transparency: reduce)'), () => Cosmos.medir())
  escuchaMQ(mq('(prefers-contrast: more)'), () => Cosmos.medir())
  const cMov = $<HTMLInputElement>('#cMovSuave')
  cMov.checked = movSuave()
  escuchar(cMov, 'change', () => { fijarMovSuave(cMov.checked); Onda.despertar(); Cosmos.cambio() })
  SinSalto.iniciar()
  escuchar($('#frase'), 'click', cortarDecir) // un toque en la frase la completa…
  escuchar($('#btnCompletar'), 'click', cortarDecir) // …y este botón hace lo mismo sin gesto
  escuchar($('#btnAbrir'), 'click', () => abrirSala())
  escuchar($('#btnCerrar'), 'click', () => cerrarSala())
  escuchar($('#btnMas'), 'click', alternarMenuMas)
  escuchar($('#btnRapido'), 'click', () => { cerrarMenuMas(); void modoRapido() })
  escuchar($('#btnRespirar'), 'click', () => void respirar())
  escuchar($('#btnRespirarMenu'), 'click', () => { cerrarMenuMas(); void respirar() })
  escuchar($('#btnForm'), 'click', () => {
    cerrarMenuMas(); cerrarSala(true)
    $('#formPlegado').hidden = false; $('#btnPrefieroForm').setAttribute('aria-expanded', 'true'); guardar('prefiereForm', true)
    traerALaVista($('#formPlegado'), 'center')
    $('#btnVolverPraxis').focus({ preventScroll: true })
    if (!conectada()) aviso(tu('El formulario de siempre. Tu borrador de Praxis queda guardado.', 'El formulario de siempre. Su borrador de Praxis queda guardado.'))
  })
  conectarVoz()
  escuchar($('#btnMic'), 'click', () => { if (Mic.activo) detenerMic(true); else iniciarMic() })
  const entrada = $<HTMLInputElement>('#entrada')
  escuchar(entrada, 'focus', () => Onda.foco(true)) // la postura de escucha: un tono intermedio, no un eco de cada tecla
  escuchar(entrada, 'blur', () => Onda.foco(false))
  escuchar($('#formTexto'), 'submit', (e) => {
    e.preventDefault()
    const t = entrada.value.trim()
    if (!t) return
    entrada.value = ''
    if (Mic.activo) detenerMic(false)
    enviarTexto(t, 'texto')
    Barra.cerrar() // conectada, al enviar la barra vuelve a plegarse
  })
  conectarHablar() // mantener el agujero para hablar (hablar.ts)
  conectarBarra(conectada()) // conectada, la barra para escribir nace plegada (barra.ts)
  /* Compactar al primer toque o desplazamiento (lo que llegue antes que el fin de la frase) */
  const cuerpo = $('#salaCuerpo')
  escuchar(cuerpo, 'pointerdown', (e) => Cab.toque(e), { passive: true })
  escuchar(cuerpo, 'wheel', () => Cab.toque(), { passive: true })
  escuchar(cuerpo, 'scroll', velarLuego, { passive: true }) // la frase larga: lo que queda bajo la cabecera se apaga, lo que vuelve a bajar se enciende
  escuchar(cuerpo, 'touchmove', () => Cab.toque(), { passive: true })
  escuchar(document, 'pointerdown', (e) => { const m = $('#menuMas'), t = e.target as Element | null; if (m && !m.hidden && !(t && t.closest('#menuMas, #btnMas'))) cerrarMenuMas() }, { passive: true })
  escuchar(document, 'keydown', (e) => {
    if ((e as KeyboardEvent).key !== 'Escape' || $('#sala').hidden) return
    if (!$('#menuMas').hidden) { cerrarMenuMas(); $('#btnMas').focus({ preventScroll: true }); return }
    cerrarSala()
  })
  /* El teclado de iOS: el muelle sube con visualViewport (en Android, interactive-widget=resizes-content ya lo resuelve) */
  const vv = window.visualViewport
  if (vv) {
    const ajusta = () => { const ocupa = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); $('#muelle').style.transform = ocupa > 80 ? `translateY(${-ocupa}px)` : '' }
    escuchar(vv, 'resize', ajusta); escuchar(vv, 'scroll', ajusta)
  }
  let anchoPrev = window.innerWidth, tRe = 0
  escuchar(window, 'resize', () => { if (window.innerWidth !== anchoPrev) { anchoPrev = window.innerWidth; clearTimeout(tRe); tRe = window.setTimeout(() => { renderPartitura(); renderCordillera(); Penta.colocar() }, 200) } })
  try { if (document.fonts && document.fonts.ready) void document.fonts.ready.then(() => Penta.colocar()) } catch { /* nada */ }
  escuchar(document, 'visibilitychange', () => {
    dormirEco(document.hidden) // el audio también se duerme con la pestaña
    if (document.hidden) { if (!$('#sala').hidden && S.t0 && !S.pausaDesde) S.pausaDesde = performance.now(); Voz.callar(); return }
    if ($('#sala').hidden) return
    if (S.pausaDesde) { S.pausa += performance.now() - S.pausaDesde; S.pausaDesde = 0 }
    Onda.despertar()
    if (!S.listo && !S.quieta && S.t0 && S.turno !== 'demo') aviso('¿Seguimos?')
  })
  if (conectada()) { const ir = raiz.querySelector('#btnIrFormulario'); if (ir) escuchar(ir, 'click', () => conexion?.irAlFormulario?.()) }
  else Demo.iniciar() // el selector de estados es de la demostración

  alDesmontar(() => {
    cancelar(); clearTimeout(Sala.tAbrir); clearTimeout(tRe); clearTimeout(Escena.tRes); callarAviso()
    if (Mic.activo) { clearInterval(Mic.int); Mic.activo = false }
    Demo.detener(); Viajeras.limpiar(); limpiarAnimsSala(); SinSalto.detener()
    Voz.activa = false; Voz.callar(); cerrarEco(); soltarBody(); fijarConexion(null)
  })
  return { desmontar: limpiarEntorno, alCambiarTema: aplicarTema }
}

function conectarVoz(): void {
  const btn = $('#btnVoz'), txt = $('#btnVozTxt')
  const avisarVoz = () => {
    Voz.esperando = false
    const v = Voz.elegir()
    if (!v) { Voz.activa = false; btn.setAttribute('aria-pressed', 'false'); txt.textContent = 'Voz de Praxis'; aviso(tu('Tu navegador solo tiene voces en línea o ninguna en español. Praxis sigue en texto para no enviar lo que cuentas.', 'Su navegador solo tiene voces en línea o ninguna en español. Praxis sigue en texto para no enviar lo que cuenta.'), 5200); return }
    aviso(tu('Voz sintética de tu aparato: ', 'Voz sintética de su aparato: ') + v.name + '.')
    const actual = ($('#frase').textContent || '').trim()
    if (actual) { Onda.estado('habla'); Voz.decir(actual, () => Onda.pulsoPraxis(), () => { if (Onda.estadoActual === 'habla') Onda.estado(S.enFirma ? 'firma' : 'reposo') }) }
  }
  try { if (window.speechSynthesis) escuchar(window.speechSynthesis, 'voiceschanged', () => { if (Voz.esperando && Voz.activa) avisarVoz() }) } catch { /* nada */ }
  escuchar(btn, 'click', () => {
    if (!Voz.disponible()) { aviso('Este navegador no tiene voz sintética. Praxis sigue en texto.'); return }
    Voz.activa = !Voz.activa
    btn.setAttribute('aria-pressed', String(Voz.activa)); txt.textContent = Voz.activa ? 'Voz de Praxis: encendida' : 'Voz de Praxis'
    if (!Voz.activa) { Voz.esperando = false; Voz.callar(); cortarDecir(); return } // apagar la voz también sirve para callarla
    if (Voz.hayVoces()) avisarVoz()
    else { Voz.esperando = true; aviso('Buscando una voz en español…'); setTimeout(() => { if (Voz.esperando && Voz.activa) avisarVoz() }, 1500) } // Chrome entrega las voces después
  })
}
