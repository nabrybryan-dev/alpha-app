/**
 * EL TEMA ACTIVO, LEÍDO DEL DOM Y NO DE REACT.
 *
 * El tema vive en `data-theme` sobre `<html>` (lo escribe `ThemeProvider`). Hay dos
 * consumidores que no pueden esperar a un render: la escena 3D, que pide los tokens
 * dentro de su bucle, y cualquier pieza que se monte fuera del proveedor —los tests,
 * el visor suelto—. Este módulo lee el atributo, escucha sus cambios y avisa.
 *
 * La media oscura es el respaldo cuando el atributo todavía no está: en el primer
 * fotograma, antes del efecto de `ThemeProvider`, la app no ha fijado nada y el
 * sistema es la única respuesta. En jsdom no hay `matchMedia`, así que se queda en
 * el tema de siempre (`dark`), que es el valor con el que se pintan los tokens.
 */

export type Tema = 'dark' | 'light'

export const TEMA_POR_DEFECTO: Tema = 'dark'

function esTema(valor: string | null | undefined): valor is Tema {
  return valor === 'dark' || valor === 'light'
}

function prefiereClaro(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
}

/**
 * El tema que MANDA sobre un elemento: el `data-theme` más cercano, y si no hay,
 * el de `<html>`, y si tampoco, la media del sistema. Un contenedor con su propio
 * `data-theme` (una pantalla que todavía lo fije) gana sobre la raíz.
 */
export function temaDeUnElemento(elemento?: Element | null): Tema {
  if (typeof document === 'undefined') return TEMA_POR_DEFECTO
  const desde = elemento ?? document.documentElement
  const propio = desde.closest?.('[data-theme]')?.getAttribute('data-theme')
  if (esTema(propio)) return propio
  const raiz = document.documentElement.getAttribute('data-theme')
  if (esTema(raiz)) return raiz
  return prefiereClaro() ? 'light' : TEMA_POR_DEFECTO
}

/** El tema de la raíz, que es el que elige la persona en Ajustes. */
export function leerTemaDelDocumento(): Tema {
  return temaDeUnElemento(document?.documentElement)
}

const oyentes = new Set<() => void>()
let observador: MutationObserver | undefined
let media: MediaQueryList | undefined

function avisar(): void {
  for (const oyente of oyentes) oyente()
}

function empezarAObservar(): void {
  if (typeof document === 'undefined') return
  if (!observador && typeof MutationObserver === 'function') {
    observador = new MutationObserver(avisar)
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }
  if (!media && typeof matchMedia === 'function') {
    media = matchMedia('(prefers-color-scheme: light)')
    media.addEventListener?.('change', avisar)
  }
}

function dejarDeObservarSiNadieEscucha(): void {
  if (oyentes.size > 0) return
  observador?.disconnect()
  observador = undefined
  media?.removeEventListener?.('change', avisar)
  media = undefined
}

/** Avisa de cada cambio de tema. Devuelve la baja. */
export function suscribirseAlTema(oyente: () => void): () => void {
  oyentes.add(oyente)
  empezarAObservar()
  return () => {
    oyentes.delete(oyente)
    dejarDeObservarSiNadieEscucha()
  }
}
