import { Anim, refrescar } from './cabecera'
import { abrirEditor } from './controles'
import { ETQ, LINEAS, NOMBRE, NOTA_TXT, OBLIG, ORDEN, fijarDato, type Campo, type DatosDia, type Linea, type Valor } from './datos'
import { $, $$, alTocar, h, sv, trasladoY } from './dom'
import { raiz, reducido, tieneAnimate, tu, vibrar } from './entorno'
import { actualizarFirma } from './fases'
import { decirCorto } from './frase'
import { DUR, EASE, num } from './movimiento'
import { Onda } from './onda'
import { S, emitir, guardarBorrador, refDe, rotulo, type Fuente } from './sesion'
import { abreviar, fmtMiles, fmtNum, sesion, yArco } from './texto'

/* ——— Anotar: el dato es de la cadena; la forma es de la persona ——— */
export function anotar(campo: Campo, valor: Valor | null | undefined, fuente: Fuente = 'toque', cita: string | null = null): void {
  if (valor == null || valor === '') return // la conversación nunca borra con un vacío
  const antes = S.datos[campo]
  fijarDato(S.datos, campo, valor); S.fuentes[campo] = fuente; S.ref[campo] = refDe(campo)
  if (cita) S.citas[campo] = cita; else if (fuente === 'toque') delete S.citas[campo]
  delete S.dudas[campo]
  if (campo === 'dolor' && valor === 0) { delete S.datos.dolorDonde; delete S.citas.dolorDonde }
  Penta.render(campo)
  Onda.forma(S.datos)
  if (campo === 'estres') Onda.tension(valor === 'MUCHO' ? 1.45 : valor === 'REGULAR' ? 1.2 : 1)
  if (campo === 'entreno' && valor !== 'Descansé') Onda.golpe()
  vibrar()
  if (S.enFirma) { if (antes !== undefined && antes !== valor) decirCorto('Corregido.'); void Onda.firmar(S.datos); actualizarFirma() }
  guardarBorrador()
}
export function anotarDuda(campo: Campo, opciones: string[], cita: string, fuente: Fuente): void { S.dudas[campo] = { opciones, cita }; S.fuentes[campo] = fuente; Penta.render(campo) }
export function tocar(campo: Campo, valor: Valor, fuente: Fuente = 'toque', cita: string | null = null): void { anotar(campo, valor, fuente, cita); Onda.pulso(); refrescar(); emitir({ tipo: 'toque', campo }) }
/* Los datos se quitan por un solo camino: pentagrama, onda y borrador siguen al estado */
export function quitarDato(campo: Campo): void {
  delete S.datos[campo]; delete S.fuentes[campo]; delete S.citas[campo]; delete S.ref[campo]
  Penta.render(); Onda.forma(S.datos)
  if (S.enFirma) { void Onda.firmar(S.datos); actualizarFirma() }
  guardarBorrador()
}

function textoNota(c: Campo, d: DatosDia): string {
  switch (c) {
    case 'horaAcostarse': return d.horaAcostarse || ''
    case 'horaLevantarse': return d.horaLevantarse || ''
    case 'horasSueno': return fmtNum(d.horasSueno as number) + ' H'
    case 'calidadSueno': case 'cansancio': case 'motivacion': case 'alimentacion': case 'estres': return NOTA_TXT[c][d[c] as string]
    case 'entreno': return d.entreno === 'Descansé' ? 'DESCANSÉ' : sesion(d.entreno || '').toUpperCase()
    case 'rendimiento': return d.entreno === 'Descansé' ? ({ MALA: 'ME SENTÍ MAL', REGULAR: 'ME SENTÍ REGULAR', BUENA: 'ME SENTÍ BIEN' } as Record<string, string>)[d.rendimiento as string] : NOTA_TXT.rendimiento[d.rendimiento as string]
    case 'dolor': if (d.dolor == null) return abreviar(d.dolorDonde || ''); return d.dolor === 0 ? 'NADA · 0' : 'DOLOR ' + d.dolor + (d.dolorDonde ? ' · ' + abreviar(d.dolorDonde) : '')
    case 'pasos': return fmtMiles(d.pasos as number) + ' PASOS'
    case 'hambreEscala': return 'HAMBRE ' + d.hambreEscala
    case 'comentarios': return '«' + d.comentarios + '»'
  }
  return ''
}
const ARCOS: Record<Linea, [number, number]> = { sueno: [22, 6], energia: [20, 8], cuerpo: [18, 10], comida: [13, 21], mente: [10, 24] }

/* La estrella que sale del borde del disco, viaja y se posa en su nota. El dato ya está escrito: esto es solo luz. */
interface Vuelo { el: HTMLElement; anim: Animation }
export const Viajeras = {
  n: 0, tReset: 0, activas: new Set<Vuelo>(), timers: new Set<number>(),
  limpiar(): void {
    this.activas.forEach((a) => { try { a.anim.cancel() } catch { /* nada */ } a.el.remove() }); this.activas.clear()
    this.timers.forEach((t) => clearTimeout(t)); this.timers.clear()
    $$('.nota-i.vuelo').forEach((w) => w.classList.remove('vuelo'))
  },
  destello(w: Element): void { const halo = w.querySelector('.halo'); if (halo && tieneAnimate() && !reducido()) halo.animate([{ opacity: 0 }, { opacity: 0.6, offset: 0.35 }, { opacity: 0 }], { duration: DUR.base, easing: 'ease' }) },
  lanzar(w: HTMLElement): void {
    const nota = w.querySelector<HTMLElement>('.nota')
    if (!nota) { w.classList.remove('vuelo'); return }
    const i = Math.min(this.n++, 4), d = i * DUR.anticipa // escalonado de 120 ms en el orden de lectura, con un máximo de 5 estrellas
    clearTimeout(this.tReset); this.tReset = window.setTimeout(() => { this.n = 0 }, 800)
    const aterriza = () => { if (!w.classList.contains('vuelo')) return; w.classList.remove('vuelo'); this.destello(w) }
    this.timers.add(window.setTimeout(() => this.despegar(w, nota, aterriza), d))
    this.timers.add(window.setTimeout(aterriza, d + DUR.escena + 900)) // por si la pestaña estuvo oculta
  },
  despegar(w: HTMLElement, nota: HTMLElement, aterriza: () => void): void {
    if (!w.isConnected || !w.classList.contains('vuelo')) return
    /* El destino es donde la nota va a quedar, no donde está ahora: si la cabecera se compacta en este mismo instante (FLIP), se descuenta su traslación */
    const ty = trasladoY($('#salaResto'))
    const r = nota.getBoundingClientRect(), x2 = r.left + 7.5, y2 = r.top - ty + r.height / 2
    const cuerpo = $('#salaCuerpo').getBoundingClientRect(), muelle = $('#muelle').getBoundingClientRect()
    const visible = x2 > 4 && x2 < window.innerWidth - 4 && y2 > cuerpo.top + 16 && y2 < (muelle.height ? muelle.top : window.innerHeight) - 4
    /* Enciende el punto del borde (y con movimiento reducido es todo lo que se mueve: 600 ms de opacidad). El origen es el disco tal como estará al despegar */
    const p0 = Onda.punto(x2, y2, DUR.anticipa + (Anim.flip ? 60 : 0))
    if (!p0 || !visible || reducido() || !tieneAnimate() || this.activas.size >= 5) { aterriza(); return }
    const el = h('span', { class: 'viajera', 'aria-hidden': 'true' })
    raiz().append(el)
    const cx = p0.x + (x2 - p0.x) * 0.7, cy = p0.y + (y2 - p0.y) * 0.05 // el control queda a la altura del disco: sale del plano y luego cae
    const frames: Keyframe[] = []
    for (let k = 0; k <= 7; k++) { const u = k / 7, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; frames.push({ transform: `translate(${(a * p0.x + b * cx + c * x2).toFixed(1)}px, ${(a * p0.y + b * cy + c * y2).toFixed(1)}px)` }) }
    if (Anim.flip) { frames[0].opacity = 0; frames[1].opacity = 1 } // la cabecera se está moviendo: la estrella no se ve hasta despegar
    const anim = el.animate(frames, { duration: DUR.escena, delay: DUR.anticipa, easing: EASE.cajon, fill: 'both' })
    const rec = { el, anim }
    this.activas.add(rec)
    anim.onfinish = () => { el.remove(); this.activas.delete(rec); aterriza() }
    anim.oncancel = () => { el.remove(); this.activas.delete(rec) }
  },
}

interface Descriptor { k: string; c: Campo; tipo: 'nota' | 'duda' | 'hueco' | 'cero'; txt?: string }
type Posiciones = Map<Element, { x: number; y: number }>
const flips = new WeakMap<Element, Animation>()

export const Penta = {
  abierto: false,
  /* Entrar en la firma: el pentagrama se ABRE en 240 ms (--ease-cajon). Las notas que ya estaban son las mismas y se deslizan a su sitio de la firma
     (FLIP por clave, sin vaciar); las que faltan (los huecos «FALTA…») y los arcos entran con opacidad. */
  abrir(): void {
    const antes = this.posiciones()
    this.abierto = true; $('#penta').classList.add('abierto')
    Viajeras.limpiar() // ya no hay órbita cerrada a la que llegar: lo que volaba aterriza
    this.render(null, { antes, abre: true })
  },
  cerrar(): void { this.abierto = false; $('#penta').classList.remove('abierto'); this.vaciar(); this.render() },
  vaciar(): void { LINEAS.forEach((lin) => { const p = $('#pista-' + lin); p.textContent = ''; p.classList.remove('desborda') }); Viajeras.limpiar() },
  dentro(lin: Linea): HTMLElement {
    const pista = $('#pista-' + lin)
    let d = pista.firstElementChild as HTMLElement | null
    if (!d) { d = h('div', { class: 'pista-in' }); d.append(sv('svg', { class: 'arco', 'aria-hidden': 'true' })); pista.append(d) }
    return d
  },
  /* Qué debe haber en cada órbita, en orden. Cada cosa lleva una clave: lo que ya estaba se queda (mismo nodo) y solo se añade o se cambia lo que cambió. */
  descriptores(lin: Linea, campos: Campo[]): Descriptor[] {
    const d = S.datos, out: Descriptor[] = []
    for (const c of campos) {
      const tiene = c === 'dolor' ? d.dolor != null || !!d.dolorDonde : d[c] != null && d[c] !== ''
      if (tiene) out.push({ k: 'nota:' + c, c, tipo: 'nota' })
      else if (S.dudas[c]) out.push({ k: 'duda:' + c, c, tipo: 'duda' })
      else if (this.abierto && OBLIG.includes(c)) out.push({ k: 'hueco:' + c, c, tipo: 'hueco', txt: 'FALTA ' + NOMBRE[c].toUpperCase() })
    }
    if (this.abierto && lin === 'cuerpo' && d.dolor == null && d.dolorDonde) out.push({ k: 'hueco:dolor0', c: 'dolor', tipo: 'hueco', txt: 'FALTA EL DOLOR' })
    if (this.abierto && lin === 'cuerpo' && num(d.dolor) > 0 && !d.dolorDonde) out.push({ k: 'hueco:donde', c: 'dolor', tipo: 'hueco', txt: 'FALTA DÓNDE DUELE' })
    if (this.abierto && lin === 'cuerpo' && d.pasos == null) out.push({ k: 'pasos', c: 'pasos', tipo: 'cero', txt: 'PASOS —' })
    return out
  },
  contenido(desc: Descriptor): { el: HTMLElement; sig: string } {
    const c = desc.c, d = S.datos, abierto = this.abierto
    if (desc.tipo === 'nota') {
      const texto = textoNota(c, d), cita = abierto && S.citas[c] && c !== 'comentarios' ? S.citas[c] : '', ambar = c === 'dolor' && num(d.dolor) >= 4
      const cls = 'nota' + (c === 'dolor' && d.dolor === 0 ? ' cero' : '')
      const el = h(abierto ? 'button' : 'span', { class: cls, type: abierto ? 'button' : null, 'aria-label': abierto ? (NOTA_TXT[c] ? '' : rotulo(c) + ': ') + texto + tu('. Toca para corregir.', '. Toque para corregir.') : null })
      const fila = h('span', { class: 'fila-nota' }, !abierto && !NOTA_TXT[c] ? h('span', { class: 'sr' }, rotulo(c) + ': ') : null, texto)
      if (ambar) fila.append(h('span', { class: 'ambar', 'aria-hidden': 'true' }))
      el.append(h('i', { class: 'halo', 'aria-hidden': 'true' }), fila)
      if (cita) el.append(h('span', { class: 'cita' }, '«' + cita + '»'))
      if (abierto) alTocar(el, 'click', () => abrirEditor(c))
      return { el, sig: [texto, cita, ambar ? 1 : 0, abierto ? 1 : 0].join('|') }
    }
    if (desc.tipo === 'duda') {
      const du = S.dudas[c]
      const g = h('span', { class: 'nota dudosa', role: 'group', 'aria-label': 'Nota dudosa, «' + du.cita + '»: ' + du.opciones.map((o) => (ETQ[c] ? ETQ[c][o] : o)).join(' o ') })
      du.opciones.forEach((o) => g.append(h('button', { type: 'button', onclick: () => { anotar(c, o, S.fuentes[c] || 'texto', du.cita); Onda.pulso(); refrescar(); emitir({ tipo: 'toque' }) } }, ETQ[c] ? ETQ[c][o] : o)))
      return { el: g, sig: 'duda|' + du.opciones.join(',') + '|' + du.cita }
    }
    if (desc.tipo === 'hueco') return { el: h('button', { type: 'button', class: 'hueco', onclick: () => abrirEditor(c) }, desc.txt), sig: 'hueco|' + desc.txt }
    return { el: h('span', { class: 'nota cero' }, h('span', { class: 'fila-nota' }, desc.txt)), sig: 'cero|' + desc.txt }
  },
  /* Dónde está ahora cada nota (el valor visible, con cualquier deslizamiento en curso). null si no hay nada que animar. */
  posiciones(): Posiciones | null {
    if (!tieneAnimate() || reducido() || $('#sala').hidden || $('#penta').hidden) return null
    const m: Posiciones = new Map()
    $$('#penta .nota-i').forEach((n) => { const r = n.getBoundingClientRect(); if (r.width || r.height) m.set(n, { x: r.left, y: r.top }) })
    return m
  },
  /* FLIP de las notas: la misma nota se desliza desde donde estaba (240 ms). Con --ease-mov cuando solo se acomodan; con --ease-cajon al abrir la firma. */
  deslizar(antes: Posiciones | null, abre?: boolean): void {
    if (!antes || !tieneAnimate()) return
    const ease = abre ? EASE.cajon : EASE.mov
    $$('#penta .nota-i').forEach((n) => {
      const previa = flips.get(n)
      if (previa) { try { previa.cancel() } catch { /* nada */ } flips.delete(n) }
      const p = antes.get(n)
      if (!p) { if (abre) n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.base, easing: ease }); return }
      const r = n.getBoundingClientRect(), dx = p.x - r.left, dy = p.y - r.top
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
      const a = n.animate([{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { transform: 'none' }], { duration: DUR.base, easing: ease })
      flips.set(n, a)
      a.onfinish = a.oncancel = () => { if (flips.get(n) === a) flips.delete(n) }
    })
    if (abre) $$('#penta .arco').forEach((a) => a.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.base, easing: ease }))
  },
  /* En la órbita cerrada las notas van en orden de LLEGADA (una línea de tiempo: la estrella nueva cae al final y nada se mueve); en la firma, en el orden fijo de ORDEN. */
  render(nuevo?: Campo | null, opt: { antes?: Posiciones | null; abre?: boolean } = {}): void {
    const antes = opt.antes !== undefined ? opt.antes : this.posiciones()
    const creadas: HTMLElement[] = []
    for (const lin of LINEAS) {
      const dentro = this.dentro(lin), arco = dentro.querySelector(':scope > .arco') as Element
      const previos = new Map<string, HTMLElement>()
      ;(Array.from(dentro.children) as HTMLElement[]).forEach((n) => { if (n.dataset && n.dataset.c) previos.set(n.dataset.c, n) })
      let cursor: Node | null = arco.nextSibling
      let lista = this.descriptores(lin, ORDEN[lin])
      if (!this.abierto) { // lo que ya estaba conserva su lugar; lo nuevo va al final, en el orden de ORDEN entre sí
        const rango = new Map(Array.from(previos.keys()).map((k, i) => [k, i] as [string, number]))
        lista = lista.map((d, i) => ({ d, r: rango.get(d.k) ?? 1e6 + i })).sort((a, b) => a.r - b.r).map((x) => x.d)
      }
      for (const desc of lista) {
        let w = previos.get(desc.k)
        previos.delete(desc.k)
        const cont = this.contenido(desc)
        if (!w) {
          w = h('span', { class: 'nota-i', role: 'listitem', 'data-c': desc.k }); w.append(cont.el); w.dataset.sig = cont.sig
          if (desc.c === nuevo && desc.tipo === 'nota') { w.classList.add('vuelo'); creadas.push(w) } // nace posada en su sitio, apagada, hasta que llega la estrella
        } else if (w.dataset.sig !== cont.sig) { // una corrección: el mismo nodo cambia su texto y hace un destello
          w.textContent = ''; w.append(cont.el); w.dataset.sig = cont.sig
          if (desc.tipo === 'nota' && !opt.abre) Viajeras.destello(w)
        }
        if (w !== cursor) dentro.insertBefore(w, cursor); else cursor = cursor.nextSibling
      }
      previos.forEach((n) => n.remove())
    }
    this.colocar()
    this.deslizar(antes, opt.abre)
    creadas.forEach((w) => { Penta.mostrar(w); Viajeras.lanzar(w) })
    const gr = $('#gracias')
    gr.textContent = ''
    if (S.hilo && S.hilo !== 'saltar') gr.append(h('span', { class: 'gracia', title: 'La idea de ayer' }))
    if (S.nota === true || S.nota === false) gr.append(h('span', { class: 'gracia chica', title: 'La nota de la semana' }))
  },
  /* Pone cada nota sobre su arco y dibuja el arco. El periodo es el ancho visible: si la pista desborda, el arco se repite y las notas anteriores no se mueven. */
  colocar(): void {
    for (const lin of LINEAS) {
      const pista = $('#pista-' + lin), dentro = pista.firstElementChild as HTMLElement | null
      if (!dentro || !pista.clientWidth) continue
      const [y0, yc] = ARCOS[lin], P = Math.max(80, pista.clientWidth), abierto = this.abierto, arco = dentro.querySelector(':scope > .arco') as Element
      const notas = (Array.from(dentro.children) as HTMLElement[]).filter((n) => n !== arco)
      let d = ''
      if (!abierto) {
        for (const w of notas) {
          if (w.querySelector('.dudosa') || w.querySelector('.hueco')) { w.style.top = '0px'; continue }
          const x = w.offsetLeft + 7.5, t = (x % P) / P
          w.style.top = (yArco(t, y0, yc) - w.offsetHeight / 2).toFixed(1) + 'px'
        }
        const total = Math.max(P, dentro.scrollWidth)
        for (let k = 0; k * P < total - 1; k++) d += `M${k * P} ${y0}Q${k * P + P / 2} ${yc} ${(k + 1) * P} ${y0}`
        arco.setAttribute('width', String(total)); arco.setAttribute('height', '30'); arco.setAttribute('viewBox', `0 0 ${total} 30`)
        pista.classList.toggle('desborda', dentro.scrollWidth > pista.clientWidth + 1)
      } else {
        const filas = Math.max(1, Math.round((dentro.offsetHeight - 8 + 10) / 54))
        for (const w of notas) {
          const x = w.offsetLeft + 8, t = (x % P) / P
          w.style.top = ((yArco(t, y0, yc) - 14) * 0.6).toFixed(1) + 'px'
        }
        for (let r = 0; r < filas; r++) { const c = 4 + 54 * r + 22, a0 = c + (y0 - 14) * 0.6, ac = c + (yc - 14) * 0.6; d += `M0 ${a0.toFixed(1)}Q${P / 2} ${ac.toFixed(1)} ${P} ${a0.toFixed(1)}` }
        arco.setAttribute('width', String(P)); arco.setAttribute('height', String(dentro.offsetHeight)); arco.setAttribute('viewBox', `0 0 ${P} ${dentro.offsetHeight}`)
        pista.classList.remove('desborda')
      }
      let path = arco.firstElementChild
      if (!path) { path = sv('path'); arco.append(path) }
      if (path.getAttribute('d') !== d) path.setAttribute('d', d)
    }
  },
  /* Si la nota nueva queda fuera de la pista, la pista se desplaza hasta ella (suave; con movimiento reducido, de golpe) */
  mostrar(w: HTMLElement): void {
    const pista = w.closest<HTMLElement>('.pista')
    if (!pista || this.abierto) return
    const fin = w.offsetLeft + w.offsetWidth + 24, vis = pista.scrollLeft + pista.clientWidth
    if (fin > vis && typeof pista.scrollTo === 'function') pista.scrollTo({ left: fin - pista.clientWidth, behavior: reducido() ? 'auto' : 'smooth' })
  },
}
