import { abrirEditor } from './controles'
import { Cosmos } from './cosmos'
import { $, morphHijos, trasladoY } from './dom'
import { raiz, reducido, tieneAnimate } from './entorno'
import { Escena } from './escena'
import { ponerSugerencias } from './frase'
import { DUR, EASE, MS_POR_PX, clamp, esperar } from './movimiento'
import { Onda } from './onda'
import { S } from './sesion'

/**
 * La cabecera de la sala (el agujero) y lo que se mueve debajo de ella.
 *
 * Compactar es FLIP, nunca `height` animado: la caja cambia de alto al instante y lo que
 * sigue vuelve a su sitio con translateY. El desplazamiento de la sala no usa scroll suave
 * (saltaba hasta 21 px entre cuadros): el scroll cambia de una vez y #salaResto vuelve con
 * translateY(Δ → 0), --ease-desliz y 8,3 ms por px: nunca más de 3,2 px por cuadro a 60 Hz.
 */
export const Sala = {
  estado: 'cerrada' as 'cerrada' | 'abriendo' | 'abierta' | 'cerrando',
  anims: [] as Animation[], clon: null as HTMLElement | null, tAbrir: 0, limpiar: false, avisoBorrador: false, enfocar: false,
}
export const Anim = { flip: null as Animation | null, desliz: null as Animation | null }

/* ——— Montar y refrescar no destruyen: el árbol nuevo se compara con el vivo por data-k (ver morphHijos) ——— */
export function montar(fn: NonNullable<typeof S.montar> | null): void {
  S.montar = fn
  const c = $('#controles'), primera = !c.firstChild
  const nodos = fn ? ([] as (Node | null | false)[]).concat(fn()).filter((n): n is Node => !!n) : []
  morphHijos(c, nodos)
  if (primera) (Array.from(c.children) as HTMLElement[]).slice(0, 6).forEach((el, i) => { el.style.setProperty('--i', String(i)); el.classList.add('praxis-aparece') }) // 240 ms, escalonado de 60 ms, máximo 6
}
export function refrescar(): void {
  const previo = document.activeElement
  if (S.montar) montar(S.montar)
  if (!$('#editor').hidden && S.editando) abrirEditor(S.editando, true)
  if (previo && previo !== document.body && !document.contains(previo)) { // se reemplazó: el foco vuelve al nodo con la misma clave
    const k = previo.getAttribute('data-k')
    const el = k ? Array.from(raiz().querySelectorAll<HTMLElement>('[data-k]')).find((n) => n.getAttribute('data-k') === k) : null
    if (el) el.focus({ preventScroll: true })
  }
}

export function deslizar(d: number): void {
  const cuerpo = $('#salaCuerpo'), resto = $('#salaResto')
  const destino = clamp(cuerpo.scrollTop + d, 0, Math.max(0, cuerpo.scrollHeight - cuerpo.clientHeight))
  d = destino - cuerpo.scrollTop
  if (Math.abs(d) < 1) return
  if (reducido() || !tieneAnimate() || $('#sala').hidden) { cuerpo.scrollTop = destino; return }
  const ty0 = Anim.desliz ? trasladoY(resto) : 0 // desde el valor visible si ya había uno en curso
  if (Anim.desliz) { Anim.desliz.cancel(); Anim.desliz = null }
  cuerpo.scrollTop = destino
  const desde = d + ty0, dur = Math.max(DUR.panel, Math.ceil(Math.abs(desde) * MS_POR_PX))
  const a = resto.animate([{ transform: `translateY(${desde.toFixed(1)}px)` }, { transform: 'none' }], { duration: dur, easing: EASE.desliz })
  Anim.desliz = a; Escena.desliz = { t0: performance.now(), dur, desde }
  const fin = () => { if (Anim.desliz === a) { Anim.desliz = null; Escena.desliz = null; Cosmos.despertar(); velarLineas() } }
  a.onfinish = fin; a.oncancel = fin
  Cosmos.despertar()
}
/* Las líneas de la frase larga que quedan enteras por encima del borde de la cabecera se apagan (160 ms); al volver a bajar, vuelven */
function velarLineas(): void {
  const fr = $('#frase'), ws = Array.from(fr.querySelectorAll<HTMLElement>('.w')), np = $('#notaPrimera')
  if (np.textContent) ws.push(np)
  if (!fr.classList.contains('larga') || $('#sala').hidden) { ws.forEach((w) => w.classList.remove('bajo')); return }
  const cb = $('#ondaCaja').getBoundingClientRect().bottom
  ws.forEach((w) => w.classList.toggle('bajo', w.getBoundingClientRect().bottom <= cb + 1))
}
let velarPend = 0
export function velarLuego(): void { if (!velarPend) velarPend = requestAnimationFrame(() => { velarPend = 0; if (!Anim.desliz && !Anim.flip) velarLineas() }) }
export function alInicio(instante?: boolean): void {
  const c = $('#salaCuerpo')
  if (c.scrollTop <= 0) return
  if (instante) { if (Anim.desliz) Anim.desliz.cancel(); c.scrollTop = 0 } else deslizar(-c.scrollTop)
}
export function mostrarControles(libre?: boolean): void {
  /* Se mide donde las cosas van a QUEDAR. Si la cabecera se está compactando (FLIP), se espera a que acabe: dos transform sobre el mismo nodo no se suman */
  if (Anim.flip && Anim.flip.playState !== 'finished') { const f = Anim.flip; f.finished.then(() => { if (Anim.flip === f) Anim.flip = null; if (S.montar && !$('#sala').hidden) mostrarControles(libre) }, () => {}); return }
  const cuerpo = $('#salaCuerpo'), c = $('#controles'), rc = cuerpo.getBoundingClientRect()
  const tyC = trasladoY(c)
  const ty = trasladoY($('#salaResto')) // un deslizamiento en curso: lo que se ve está desplazado ty respecto de donde quedará
  const top = c.getBoundingClientRect().top - ty - tyC - rc.top, meta = cuerpo.clientHeight * 0.56
  if (top <= meta) return
  let d = top - meta
  const dicho = $('#dicho'), fr = $('#frase'), techo = rc.top + $('#ondaCaja').offsetHeight // el borde inferior de la cabecera pegajosa
  const larga = !!libre && fr.classList.contains('larga') && !dicho.classList.contains('vacio')
  if (!dicho.classList.contains('vacio') && !larga) d = Math.min(d, Math.max(0, dicho.getBoundingClientRect().top - ty - (techo + 8))) // la pregunta de Praxis no se esconde bajo la cabecera
  if (libre && c.firstElementChild) d = Math.min(d, Math.max(0, c.firstElementChild.getBoundingClientRect().bottom - ty - tyC - (rc.bottom - 8))) // solo lo justo para ver la primera fila entera
  if (larga && d > 0) {
    /* La frase larga de la primera vez ya se leyó: pueden subir bajo la cabecera sus primeras líneas (saludo y presentación), nunca la pregunta final,
       y el desplazamiento se detiene AL BORDE DE UNA LÍNEA: ninguna línea queda cortada por la mitad bajo la cabecera.
       Bordes posibles, de arriba abajo: el de la nota de la primera vez (si hay), el de la frase y el de cada línea hasta la pregunta. Se toma
       el primero que basta; si ninguno basta, el último (la pregunta nunca sube). */
    const lh = parseFloat(getComputedStyle(fr).lineHeight) || 24, np = $('#notaPrimera'), fTop = fr.getBoundingClientRect().top - ty - techo
    const bordes: number[] = []
    if (np.textContent) bordes.push(np.getBoundingClientRect().top - ty - techo)
    const ws = Array.from(fr.querySelectorAll<HTMLElement>('.w'))
    let q = 0 // la línea donde empieza la última oración (la pregunta)
    for (let i = ws.length - 1; i > 0; i--) if (/[.?!»"]$/.test(ws[i - 1].textContent || '')) { q = Math.round((ws[i].offsetTop - fr.offsetTop) / lh); break } // offsetTop va respecto de #dicho (posicionado)
    for (let k = 0; k <= q; k++) bordes.push(fTop + k * lh)
    const validos = bordes.filter((b) => b >= 0)
    if (validos.length && d > validos[0]) d = validos.find((b) => b >= d - 0.5) ?? validos[validos.length - 1]
  }
  if (d > (libre ? 1 : 24)) deslizar(d) // con «libre» (ver la primera fila entera) cuenta cada píxel; si no, no se mueve la vista por menos de 24 px
}
/* Una salida de 160 ms a medias (retirarControles) deja #controles a opacidad 0 con fill forwards: lo que se monte encima debe verse desde el primer cuadro */
export function soltarSalidaControles(): void { const c = $('#controles'); if (c.getAnimations) c.getAnimations().forEach((a) => a.cancel()) }
export function limpiarControles(): void { S.montar = null; soltarSalidaControles(); $('#controles').textContent = ''; ponerSugerencias([]) }
/* Entre un turno y el siguiente las entradas no se pisan: los controles salen en 160 ms y luego hay un hueco limpio de 120 ms */
export async function retirarControles(): Promise<void> {
  const c = $('#controles'), s0 = S, tok0 = S.tok
  S.montar = null
  if (c.firstChild && tieneAnimate() && !reducido()) {
    const a = c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.toque, easing: EASE.salida, fill: 'forwards' })
    await a.finished.catch(() => {})
    a.cancel()
    /* La seguridad va por delante: si mientras salían llegó la Quieta (o una pregunta de cuidado, o se cerró la sala), lo que hay ahora en #controles es
       nuevo y NO se borra. Quien esperaba esto ve el cambio de token en su próximo vigilar(). */
    if (S !== s0 || S.tok !== tok0 || S.quieta) return
    c.textContent = ''
  } else c.textContent = ''
  ponerSugerencias([])
  if (!reducido()) await esperar(DUR.relevo)
}

/* Compactar la cabecera: FLIP. El lienzo no se reasigna: tiene el alto máximo y solo cambia cuánto se ve (con la misma curva). */
export function compactar(si: boolean, instante?: boolean): void {
  si = !!si
  const caja = $('#ondaCaja'), col = $('#salaCol'), resto = $('#salaResto')
  if (caja.classList.contains('compacta') === si) return
  const antes = resto.getBoundingClientRect().top // el valor visible (incluye una animación en curso)
  if (Anim.flip) { Anim.flip.cancel(); Anim.flip = null }
  if (Anim.desliz) { Anim.desliz.cancel(); Anim.desliz = null } // el deslizamiento a medias entra en el FLIP: se parte del valor visible
  caja.classList.toggle('compacta', si); col.classList.toggle('compacta', si)
  Onda.compactar(si, instante)
  if (instante || reducido() || !tieneAnimate() || $('#sala').hidden) { velarLuego(); return }
  const dy = antes - resto.getBoundingClientRect().top
  if (Math.abs(dy) < 1) { velarLuego(); return }
  const a = resto.animate([{ transform: `translateY(${dy.toFixed(1)}px)` }, { transform: 'none' }], { duration: DUR.panel, easing: EASE.cajon })
  Anim.flip = a
  const fin = () => { Anim.flip = null; velarLuego() }
  a.onfinish = fin; a.oncancel = fin
}
export function soltarFlip(): void { if (Anim.flip) { Anim.flip.cancel(); Anim.flip = null } }

/* Cuándo se compacta: al terminar la primera frase o al primer toque o desplazamiento, lo que llegue antes. Nunca a mitad de una frase.
   Excepción: en pantallas bajas, si a los 400 ms el primer control queda por debajo del muelle, se compacta en ese momento. La primera vez
   no hay excepción: los controles llegan al terminar el saludo, así que no hay nada que asome. */
export const Cab = {
  pendiente: false, ayer: false,
  arma(): void { this.pendiente = !$('#ondaCaja').classList.contains('compacta') },
  compactar(): void {
    if (!this.pendiente) return
    this.pendiente = false
    compactar(true)
    setTimeout(() => { if (S.montar && !$('#sala').hidden) mostrarControles() }, reducido() ? 0 : DUR.panel + 30)
  },
  finFrase(): void {
    if (this.ayer) { this.ayer = false; Onda.forma(S.datos) } // el borde suelta la forma de ayer (τ .4 s) al acabar la primera frase
    this.compactar()
    if (S.montar && !S.quieta && !$('#sala').hidden && $('#frase').classList.contains('larga')) setTimeout(() => { if (S.montar && !$('#sala').hidden) mostrarControles(true) }, reducido() ? 0 : DUR.panel + 30) // la primera frase es larga: al acabar, la vista baja a los controles
  },
  toque(e?: Event): void {
    if ($('#sala').hidden || !this.pendiente) return
    const t = e && (e.target as Element | null)
    if (t && t.closest && t.closest('.onda-caja, #btnRespirar, #btnCompletar')) return
    this.compactar()
  },
  revisarBajas(): void {
    if (!this.pendiente) return
    const c = $('#controles').firstElementChild
    if (!c) return
    if (c.getBoundingClientRect().top > window.innerHeight - $('#muelle').offsetHeight - 8) this.compactar()
  },
}
/* Nada salta cuando cambia lo que Praxis dice encima (la pista «Toca la frase…», «Sin afán…», lo que dijo la persona, una frase de otro largo):
   un MutationObserver ve el cambio en la misma tarea y lo que va debajo vuelve a su sitio con translateY(Δ → 0),
   con la misma curva y el mismo tope (≤ 3,2 px por cuadro) que el deslizamiento. Ni el scroll ni los transform cuentan en la medida. */
export const SinSalto = {
  y: null as number | null, vacio: true, listo: false, anims: [] as Animation[], mo: null as MutationObserver | null,
  /* Dónde está #penta dentro de #salaResto sin contar su propio translateY: el FLIP y el deslizamiento de #salaResto se cancelan en la resta. */
  pos(): number { const p = $('#penta'); return p.getBoundingClientRect().top - trasladoY(p) - $('#salaResto').getBoundingClientRect().top },
  iniciar(): void {
    this.detener(); this.y = null; this.listo = false; this.anims = []
    if (typeof MutationObserver === 'undefined') return
    this.y = this.pos(); this.vacio = $('#dicho').classList.contains('vacio')
    this.mo = new MutationObserver(() => this.revisar())
    for (const el of [$('#dicho'), $('#senal')]) this.mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] })
  },
  detener(): void { if (this.mo) { this.mo.disconnect(); this.mo = null } },
  revisar(): void {
    if ($('#sala').hidden) { this.y = null; this.listo = false; return } // oculta, los rectángulos valen 0: no hay referencia
    const y = this.pos(), prev = this.y, eraVacio = this.vacio
    this.y = y; this.vacio = $('#dicho').classList.contains('vacio')
    /* La primera frase tras abrir la sala solo fija la referencia: las órbitas todavía no se ven y entran ya en su sitio (§3.1) */
    if (!this.listo) { if (($('#frase').textContent || '').trim()) this.listo = true; return }
    /* Ni cuando #dicho aparece o desaparece entero */
    if (prev == null || eraVacio || this.vacio || (Sala.estado !== 'abierta' && Sala.estado !== 'abriendo') || reducido() || !tieneAnimate()) return
    const dy = prev - y
    if (Math.abs(dy) < 1) return
    /* Un cambio a mitad de otro: se parte del valor visible y queda UN solo movimiento (dos a la vez sumarían velocidad) */
    const queda = trasladoY($('#penta'))
    this.anims.forEach((a) => { try { a.cancel() } catch { /* nada */ } }); this.anims = []
    const desde = dy + queda, dur = Math.max(DUR.base, Math.ceil(Math.abs(desde) * MS_POR_PX))
    ;['#penta', '#editor', '#controles', '#saltos'].map((q) => $(q)).filter((el) => el && !el.hidden).forEach((el) => {
      this.anims.push(el.animate([{ transform: `translateY(${desde.toFixed(1)}px)` }, { transform: 'none' }], { duration: dur, easing: EASE.desliz, composite: 'add' }))
    })
  },
  reiniciar(): void { this.anims.forEach((a) => { try { a.cancel() } catch { /* nada */ } }); this.anims = []; this.y = null; this.listo = false },
}
export function enfocarControles(): void {
  const c = $('#controles')
  if (document.activeElement === $('#entrada') || $('#sala').hidden) return
  try { c.focus({ preventScroll: true }) } catch { /* nada */ }
}
