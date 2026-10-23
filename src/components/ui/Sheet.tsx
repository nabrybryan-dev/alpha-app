import { useEffect, useRef, useState, type PointerEvent as EventoPuntero, type ReactNode } from 'react'

interface SheetProps {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  /**
   * Si la hoja entra deslizando (y se despide al cerrar) o aparece y desaparece puesta. **Por defecto anima.**
   *
   * Este primitivo no tenía ninguna entrada: `if (!abierto) return null` y la hoja
   * se materializaba en un fotograma, atenuador incluido. Lo consumen quince archivos y
   * ninguno se movía, mientras el test post —que hace exactamente lo mismo— sí
   * usaba `.scrim-entra` y `.subir-hoja`, que llevan en `tokens.css` desde siempre.
   * Eran el mismo objeto con dos personalidades a un toque de distancia.
   *
   * La opción existe por UNA razón concreta, y no es de gusto: `HojaMedicion` abre
   * la cámara, y ahí los 420 ms de la entrada caerían justo encima de `getUserMedia`
   * y de los primeros fotogramas de captura, que es el instante más caro de la app.
   * Esa hoja pasa `animar={false}` y sigue apareciendo de golpe, a propósito.
   */
  animar?: boolean
}

/** Lo que dura la salida: `--dur-base` de `tokens.css` (240 ms). Si cambia uno, cambia el otro. */
const SALIDA_MS = 240
/** Cuánto hay que arrastrar hacia abajo para que suelte la hoja, o la rapidez (px/ms) con un arrastre corto. */
const DISTANCIA_CIERRE = 120
const VELOCIDAD_CIERRE = 0.6
/** La rapidez del gesto se mide sobre estos últimos milisegundos. */
const VENTANA_VELOCIDAD_MS = 100
const DISTANCIA_MINIMA_VELOZ = 40
/** Hasta aquí es un toque, no un arrastre. */
const UMBRAL_ARRASTRE = 4

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function enfocables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((el) => !el.hasAttribute('hidden'))
}

/**
 * La pila de hojas abiertas, la de arriba al final. Escape, Tab y la vigilancia del foco son SOLO de la de
 * arriba: sin esto, `SheetDespensa` con `SheetBuscarAlimento` dentro se cerraban las dos con una Escape.
 */
interface HojaAbierta {
  id: symbol
  panel: HTMLElement
}
const pilaDeHojas: HojaAbierta[] = []

/**
 * ¿Es esta la hoja de ARRIBA? No se decide por el orden en que se apilaron (React corre los efectos de los hijos
 * antes que los del padre, y con varias hojas montadas ya abiertas a la vez la de fuera quedaba la última), sino
 * por el DOM: una hoja que contiene a otra abierta NO es la de arriba. Entre hermanas manda la que se abrió después.
 */
function esLaDeArriba(yo: symbol): boolean {
  const libres = pilaDeHojas.filter((h) => !pilaDeHojas.some((otra) => otra !== h && h.panel.contains(otra.panel)))
  return libres[libres.length - 1]?.id === yo
}

/** ¿Se puede animar la salida? Sin `matchMedia` (jsdom, navegadores muy viejos) o con movimiento reducido, no. */
function puedeAnimarSalida(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Sheet({ abierto, titulo, onCerrar, children, animar = true }: SheetProps) {
  // `montada` sigue a `abierto` pero se retrasa lo que dura la salida; así la hoja se ve despedirse.
  const [montada, setMontada] = useState(abierto)
  const [saliendo, setSaliendo] = useState(false)
  if (abierto && (!montada || saliendo)) {
    setMontada(true)
    setSaliendo(false)
  } else if (!abierto && montada && !saliendo) {
    if (animar && puedeAnimarSalida()) setSaliendo(true)
    else setMontada(false)
  }

  useEffect(() => {
    if (!saliendo) return
    const reloj = window.setTimeout(() => {
      setSaliendo(false)
      setMontada(false)
    }, SALIDA_MS)
    return () => window.clearTimeout(reloj)
  }, [saliendo])

  const panel = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLButtonElement>(null)
  const alCerrar = useRef(onCerrar)
  const sigueAbierta = useRef(abierto)
  useEffect(() => {
    alCerrar.current = onCerrar
    sigueAbierta.current = abierto
  })

  // Escape, foco atrapado y foco de vuelta a quien la abrió. Solo mientras está abierta (no mientras se despide).
  useEffect(() => {
    if (!abierto || !montada) return
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = panel.current
    // Una hoja que se reabre mientras se despedía vuelve a su sitio (si antes se la arrastró).
    if (el) {
      el.style.transform = ''
      el.style.transition = ''
      el.style.removeProperty('--sale-hasta')
    }
    if (scrim.current) scrim.current.style.opacity = ''
    const yo = Symbol('hoja')
    if (el) pilaDeHojas.push({ id: yo, panel: el })
    const dePrimera = () => esLaDeArriba(yo)
    if (el && !el.contains(document.activeElement)) {
      const primero = enfocables(el)[0] ?? el
      primero.focus({ preventScroll: true })
    }
    const alTeclear = (e: KeyboardEvent) => {
      if (!dePrimera()) return
      if (e.key === 'Escape') {
        // Si un campo de dentro ya consumió la tecla (`preventDefault`), no es para la hoja.
        if (!e.defaultPrevented) alCerrar.current()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const lista = enfocables(el)
      if (lista.length === 0) {
        e.preventDefault()
        el.focus()
        return
      }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const dentro = el.contains(document.activeElement)
      if (e.shiftKey && (!dentro || document.activeElement === primero || document.activeElement === el)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (!dentro || document.activeElement === ultimo)) {
        e.preventDefault()
        primero.focus()
      }
    }
    const alEnfocar = (e: FocusEvent) => {
      if (dePrimera() && el && e.target instanceof Node && !el.contains(e.target)) {
        const lista = enfocables(el)
        ;(lista[0] ?? el).focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('focusin', alEnfocar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('focusin', alEnfocar)
      const lugar = pilaDeHojas.findIndex((h) => h.id === yo)
      if (lugar >= 0) pilaDeHojas.splice(lugar, 1)
      if (previo?.isConnected) previo.focus({ preventScroll: true })
    }
  }, [abierto, montada])

  // Arrastrar el asa (la rayita y la cabecera) hacia abajo para cerrar.
  const arrastre = useRef<{ id: number; y0: number; dy: number; activo: boolean; muestras: { t: number; y: number }[] } | null>(null)
  const alBajarPuntero = (e: EventoPuntero<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    arrastre.current = { id: e.pointerId, y0: e.clientY, dy: 0, activo: false, muestras: [{ t: performance.now(), y: e.clientY }] }
  }
  const alMoverPuntero = (e: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    const dy = e.clientY - a.y0
    if (!a.activo) {
      if (Math.abs(dy) < UMBRAL_ARRASTRE) return
      a.activo = true
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } catch {
        /* sin captura el arrastre sigue por los eventos de la propia asa */
      }
      if (panel.current) panel.current.style.transition = 'none'
    }
    a.dy = dy
    a.muestras.push({ t: performance.now(), y: e.clientY })
    const baja = Math.max(0, dy)
    if (panel.current) panel.current.style.transform = `translateY(${baja}px)`
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - baja / 400))
  }
  const alSoltarPuntero = (e: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current
    arrastre.current = null
    if (!a || a.id !== e.pointerId || !a.activo) return
    const dy = e.clientY - a.y0
    // La rapidez es la del FINAL del gesto (últimos ~100 ms), no la media: despacio y un golpe al final es un golpe.
    const ahora = performance.now()
    const enVentana = a.muestras.filter((m) => m.t >= ahora - VENTANA_VELOCIDAD_MS)
    const desde = enVentana.length > 0 && enVentana[0] !== a.muestras[a.muestras.length - 1] ? enVentana[0] : a.muestras[Math.max(0, a.muestras.length - 2)]
    const velocidad = (e.clientY - desde.y) / Math.max(1, ahora - desde.t)
    const cierra = dy >= DISTANCIA_CIERRE || (dy >= DISTANCIA_MINIMA_VELOZ && velocidad >= VELOCIDAD_CIERRE)
    if (cierra) {
      // La salida sigue hacia ABAJO desde donde se soltó el dedo (si no, la hoja subiría hacia los 40 px).
      panel.current?.style.setProperty('--sale-hasta', `${Math.max(0, dy) + 40}px`)
      alCerrar.current()
      // Si quien usa la hoja no la cierra (pide confirmar, está ocupada), la hoja vuelve a su sitio.
      window.requestAnimationFrame(() => {
        if (!sigueAbierta.current || !panel.current) return
        panel.current.style.transition = 'transform var(--dur-base) var(--ease-salida)'
        panel.current.style.transform = ''
        panel.current.style.removeProperty('--sale-hasta')
        if (scrim.current) scrim.current.style.opacity = ''
      })
      return
    }
    if (panel.current) {
      panel.current.style.transition = 'transform var(--dur-base) var(--ease-salida)'
      panel.current.style.transform = ''
    }
    if (scrim.current) scrim.current.style.opacity = ''
  }

  if (!montada) return null
  const animada = animar
  return (
    // El `z-50` que había aquí no decía nada: era un número más alto que el resto
    // y ya. Ahora el atenuador y la hoja viven en capas con nombre, y se ve de un
    // vistazo que la hoja va por encima de su propio atenuador y los dos por
    // encima de la barra inferior.
    <div
      className={`fixed inset-0 flex items-end justify-center ${saliendo ? 'pointer-events-none' : ''}`}
      style={{ zIndex: 'var(--z-hoja)' }}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      aria-hidden={saliendo ? true : undefined}
    >
      <button
        ref={scrim}
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onCerrar}
        className={`absolute inset-0 bg-black/60 ${saliendo ? 'scrim-sale' : animada ? 'scrim-entra' : ''}`}
        style={{ zIndex: 'var(--z-scrim)' }}
      />
      <div
        ref={panel}
        data-testid="panel-de-la-hoja"
        tabIndex={-1}
        className={`relative max-h-[85dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border-t border-linea bg-surface-1 p-5 pb-[max(2rem,env(safe-area-inset-bottom))] outline-none ${
          saliendo ? 'bajar-hoja' : animada ? 'subir-hoja' : ''
        }`}
        style={{ zIndex: 'var(--z-hoja)' }}
      >
        <div
          data-testid="asa-de-la-hoja"
          className="-mx-5 -mt-5 px-5 pt-5"
          style={{ touchAction: 'none' }}
          onPointerDown={alBajarPuntero}
          onPointerMove={alMoverPuntero}
          onPointerUp={alSoltarPuntero}
          onPointerCancel={alSoltarPuntero}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-3" aria-hidden="true" />
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg text-texto">{titulo}</h2>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar panel"
              className="h-11 w-11 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
            >
              ✕
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
