import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface PantallaCompletaProps {
  /** El nombre que oye un lector de pantalla y que titula la barra de arriba. */
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

const ENFOCABLES =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'

/**
 * Un diálogo a pantalla completa. En el repo no había uno (`Sheet` es una hoja que sube
 * desde abajo y no pasa del 85 % de la altura), así que esto es el primero.
 *
 * - `role="dialog"` + `aria-modal`; Escape y el botón «Cerrar» (44 px) lo cierran.
 * - Bloquea el desplazamiento del fondo mientras está abierto y lo devuelve tal cual estaba.
 * - El foco entra al abrir, se queda dentro (Tab da la vuelta) y vuelve a quien lo abrió.
 * - Respeta las zonas seguras del iPhone (`env(safe-area-inset-*)`) y mide con `dvh`, que
 *   descuenta la barra de Safari; con `vh` el pie quedaba escondido detrás de ella.
 * - Va por un portal al `body`: la consola anima sus paneles con `transform`, y un
 *   `position: fixed` dentro de un ancestro con `transform` deja de ser de pantalla
 *   completa para ser del tamaño de ese ancestro.
 * - Fuerza el tema oscuro (`data-theme="dark"`): es una pantalla para mostrarse, con el
 *   fondo oscuro y el rojo de la marca, aunque la app de quien la abre esté en claro.
 *
 * El contenido se monta solo mientras está abierto (quien lo usa decide con un `&&`), así
 * que cerrado no cuesta nada ni hace ninguna lectura.
 */
export function PantallaCompleta({ titulo, onCerrar, children }: PantallaCompletaProps) {
  const raiz = useRef<HTMLDivElement>(null)
  // El último `onCerrar` sin re-suscribir el teclado en cada render del padre.
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    const quienAbrio = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    raiz.current?.focus()

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrar.current()
        return
      }
      if (e.key !== 'Tab' || !raiz.current) return
      const dentro = Array.from(raiz.current.querySelectorAll<HTMLElement>(ENFOCABLES))
      if (dentro.length === 0) return
      const primero = dentro[0]
      const ultimo = dentro[dentro.length - 1]
      const activo = document.activeElement
      if (e.shiftKey && (activo === primero || activo === raiz.current)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)

    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflowPrevio
      quienAbrio?.focus()
    }
  }, [])

  return createPortal(
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      tabIndex={-1}
      data-theme="dark"
      className="fixed inset-0 flex flex-col bg-bg text-texto focus-visible:outline-none"
      style={{ zIndex: 'var(--z-superpuesto)', height: '100dvh' }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b border-linea bg-bg/90 px-4 pb-2"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <h2 className="font-display min-w-0 truncate text-base text-texto">{titulo}</h2>
        <button
          type="button"
          onClick={onCerrar}
          className="inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-boton border border-linea bg-surface-2 px-4 text-sm font-bold text-texto"
        >
          Cerrar
        </button>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pt-4"
        style={{
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
