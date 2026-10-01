import { raiz, reducido, tu } from './entorno'
import { DUR } from './movimiento'

/** Utilidades de DOM de la escena. Todo se busca bajo la raíz `.praxis`, nunca en el documento. */
export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = raiz()): T => r.querySelector(s) as T
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = raiz()): T[] => Array.from(r.querySelectorAll(s)) as T[]

type Manejador = (e: Event) => void
const manejadores = new WeakMap<Element, Record<string, Manejador>>()
/** Un solo oyente por tipo y nodo: el manejador se puede cambiar sin perder el nodo (refrescar reutiliza los nodos vivos). */
export function alTocar(el: Element, tipo: string, fn: Manejador): void {
  let on = manejadores.get(el)
  if (!on) { on = {}; manejadores.set(el, on) }
  if (!on[tipo]) { const propios = on; el.addEventListener(tipo, (e) => { const f = propios[tipo]; if (f) f(e) }) }
  on[tipo] = fn
}

export type Attrs = Record<string, string | number | boolean | null | undefined | Manejador>
export type Hijo = Node | string | number | null | undefined | false | Hijo[]

function colgar(el: Element, hijos: Hijo[]): void {
  for (const c of hijos) {
    if (c == null || c === false) continue
    if (Array.isArray(c)) colgar(el, c)
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
}
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...kids: Hijo[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = String(v)
    else if (k === 'text') el.textContent = String(v)
    else if (typeof v === 'function') { if (k.startsWith('on')) alTocar(el, k.slice(2), v) }
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  colgar(el, kids)
  return el
}
const SVGNS = 'http://www.w3.org/2000/svg'
export function sv(tag: string, attrs?: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVGNS, tag)
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v))
  return el
}
/** La traslación vertical visible de un nodo (con cualquier animación en curso). 0 si no se puede medir. */
export function trasladoY(el: Element): number { try { return new DOMMatrix(getComputedStyle(el).transform).m42 || 0 } catch { return 0 } }
export function escalaX(el: Element): number { try { return new DOMMatrix(getComputedStyle(el).transform).a || 1 } catch { return 1 } }
/** jsdom y algún navegador viejo no traen scrollIntoView. */
export function traerALaVista(el: Element, bloque: ScrollLogicalPosition): void {
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: bloque, behavior: reducido() ? 'auto' : 'smooth' })
}

/* El aviso vive abajo y entra desde abajo (240 ms); sale por el mismo camino en 160 ms */
let tAviso = 0, tAviso2 = 0
export function aviso(txt: string, ms = 3200): void {
  const el = $('#aviso')
  clearTimeout(tAviso); clearTimeout(tAviso2)
  el.classList.remove('sale'); el.textContent = txt; el.hidden = false
  tAviso = window.setTimeout(() => {
    el.classList.add('sale')
    tAviso2 = window.setTimeout(() => { el.hidden = true; el.classList.remove('sale') }, reducido() ? 40 : DUR.toque + 30)
  }, ms)
}
export function callarAviso(): void { clearTimeout(tAviso); clearTimeout(tAviso2) }

export async function copiar(txt: string, btn: Element | null): Promise<void> {
  try { await navigator.clipboard.writeText(txt); aviso('Número copiado: ' + txt) }
  catch {
    const numero = btn && btn.parentElement && btn.parentElement.querySelector('.num, .mono')
    const s = typeof getSelection === 'function' ? getSelection() : null
    if (numero && s) { const r = document.createRange(); r.selectNodeContents(numero); s.removeAllRanges(); s.addRange(r) }
    aviso('Número seleccionado: ' + txt + tu('. Cópialo desde el menú.', '. Cópielo desde el menú.'))
  }
}

/* ——— Refrescar sin destruir ———
   Compara el árbol nuevo con el vivo y cambia solo lo que difiere. Los nodos con data-k se reutilizan (misma identidad):
   así el chip tocado cambia en el sitio, su estrella se llena en 160 ms y una transición CSS sigue su curso.
   data-plano: se compara por su HTML y se reemplaza entero.
   data-libre: el nodo se gobierna solo (tira del hambre); aquí solo se le avisa del valor nuevo. */
const NO_SINCRONIZAR = new Set(['open', 'value', 'checked'])
const gobiernos = new WeakMap<Element, (n: number) => void>()
/** El nodo «libre» dice cómo se le avisa de un valor nuevo. */
export function alCambiarValor(el: Element, fn: (n: number) => void): void { gobiernos.set(el, fn) }

function claveDe(n: Node): string | null { return n.nodeType === 1 ? (n as Element).getAttribute('data-k') || null : null }
function parchear(vivoN: Node, nuevoN: Node): void {
  if (vivoN.nodeType === 3) { const a = vivoN as Text, b = nuevoN as Text; if (a.data !== b.data) a.data = b.data; return }
  if (vivoN.nodeType !== 1) return
  const vivo = vivoN as Element, nuevo = nuevoN as Element
  if (vivo.hasAttribute('data-libre')) {
    const v = nuevo.getAttribute('data-valor') || ''
    if (vivo.getAttribute('data-valor') !== v) { vivo.setAttribute('data-valor', v); const ir = gobiernos.get(vivo); if (ir) ir(+v) }
    return
  }
  const esInput = vivo.tagName === 'INPUT'
  for (const a of Array.from(nuevo.attributes)) {
    if (NO_SINCRONIZAR.has(a.name) && (esInput || vivo.tagName === 'DETAILS')) continue
    if (vivo.getAttribute(a.name) !== a.value) vivo.setAttribute(a.name, a.value)
  }
  for (const a of Array.from(vivo.attributes)) {
    if (NO_SINCRONIZAR.has(a.name) && (esInput || vivo.tagName === 'DETAILS')) continue
    if (!nuevo.hasAttribute(a.name)) vivo.removeAttribute(a.name)
  }
  const on = manejadores.get(nuevo)
  if (on) for (const [tipo, fn] of Object.entries(on)) alTocar(vivo, tipo, fn)
  if (esInput) return // lo que la persona escribe no se pisa
  morphHijos(vivo, Array.from(nuevo.childNodes))
}
function mismoTipo(a: Node, b: Node): boolean { return a.nodeType === b.nodeType && (a.nodeType !== 1 || (a as Element).tagName === (b as Element).tagName) }
export function morphHijos(padre: Element, nuevos: Node[]): void {
  const usados = new Set<Node>(), porClave = new Map<string, Node>()
  Array.from(padre.childNodes).forEach((n) => { const k = claveDe(n); if (k && !porClave.has(k)) porClave.set(k, n) })
  let cursor: Node | null = padre.firstChild
  for (const nu of nuevos) {
    const k = claveDe(nu)
    let par: Node | null = null
    if (k) { const c = porClave.get(k); if (c && (c as Element).tagName === (nu as Element).tagName && !usados.has(c)) par = c }
    else if (cursor && !usados.has(cursor) && !claveDe(cursor) && mismoTipo(cursor, nu)) par = cursor
    if (par && nu.nodeType === 1 && (nu as Element).hasAttribute('data-plano')) {
      if ((par as Element).outerHTML !== (nu as Element).outerHTML) { padre.replaceChild(nu, par); usados.add(nu); if (cursor === par) cursor = nu.nextSibling; continue }
      usados.add(par)
      if (par === cursor) cursor = cursor.nextSibling; else padre.insertBefore(par, cursor)
      continue // igual: se queda con sus propios manejadores
    }
    if (par) {
      usados.add(par)
      if (par === cursor) cursor = cursor.nextSibling; else padre.insertBefore(par, cursor)
      parchear(par, nu)
    } else { padre.insertBefore(nu, cursor); usados.add(nu) }
  }
  Array.from(padre.childNodes).forEach((n) => { if (!usados.has(n)) padre.removeChild(n) })
}
