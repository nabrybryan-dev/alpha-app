import { $ } from './dom'
import { escuchar } from './entorno'

/**
 * La barra para escribir de la sala conectada (Bryan, 2-oct): plegada por defecto, porque
 * «todo se ve desde el agujero». Sale desde abajo cuando la persona la pide —con la voz
 * («quiero escribir», «despliega la barra»), deslizando hacia arriba desde el borde de
 * abajo o con el tirador— y se recoge al enviar o deslizando hacia abajo.
 *
 * El tirador es un botón de verdad («Escribir a Praxis», con aria-expanded): discreto a la
 * vista, pero el teclado y el lector de pantalla lo encuentran. Plegada, la barra queda
 * `inert`: ni el tabulador ni el lector entran en ella. El movimiento es solo CSS
 * (`translate` + `opacity`, `--ease-cajon`); con movimiento reducido, solo opacidad.
 */
const BORDE_PX = 96 // la franja de abajo donde empieza el gesto (por encima del indicador de inicio del iPhone)
const GESTO_PX = 40

export const Barra = {
  activa: false,
  abierta: false,
  abrir(enfocar = true): void {
    if (!this.activa) return
    this.abierta = true
    const m = $('#muelle')
    m.classList.remove('plegada'); m.inert = false; m.removeAttribute('aria-hidden')
    $('#btnEscribir').setAttribute('aria-expanded', 'true')
    if (enfocar) { try { $<HTMLInputElement>('#entrada').focus({ preventScroll: true }) } catch { /* nada */ } }
  },
  cerrar(): void {
    if (!this.activa) return
    this.abierta = false
    const m = $('#muelle'), activo = document.activeElement as HTMLElement | null
    if (activo && m.contains(activo)) activo.blur()
    m.classList.add('plegada'); m.inert = true; m.setAttribute('aria-hidden', 'true')
    $('#btnEscribir').setAttribute('aria-expanded', 'false')
  },
}

/** Con `activa` (la sala conectada) la barra nace plegada y se cuelgan los gestos; sin ella, el muelle de siempre. */
export function conectarBarra(activa: boolean): void {
  Barra.activa = activa
  const btn = $('#btnEscribir'), m = $('#muelle')
  btn.hidden = !activa
  if (!activa) { m.classList.remove('plegada'); m.inert = false; m.removeAttribute('aria-hidden'); return }
  Barra.cerrar()
  escuchar(btn, 'click', () => (Barra.abierta ? Barra.cerrar() : Barra.abrir()))
  let ini: { x: number; y: number; borde: boolean; enMuelle: boolean } | null = null
  const sala = $('#sala')
  escuchar<TouchEvent>(sala, 'touchstart', (e) => {
    const t = e.touches[0]
    if (!t || e.touches.length > 1) { ini = null; return }
    const objetivo = e.target as Element | null
    ini = { x: t.clientX, y: t.clientY, borde: t.clientY > window.innerHeight - BORDE_PX, enMuelle: !!(objetivo && objetivo.closest && objetivo.closest('#muelle')) }
  }, { passive: true })
  escuchar<TouchEvent>(sala, 'touchend', (e) => {
    const t = e.changedTouches[0], i = ini
    ini = null
    if (!t || !i) return
    const dx = t.clientX - i.x, dy = t.clientY - i.y
    if (Math.abs(dx) > Math.abs(dy)) return
    if (!Barra.abierta && i.borde && dy < -GESTO_PX) Barra.abrir()
    else if (Barra.abierta && (i.enMuelle || i.borde) && dy > GESTO_PX) Barra.cerrar()
  }, { passive: true })
}
