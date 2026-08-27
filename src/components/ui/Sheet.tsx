import type { ReactNode } from 'react'

interface SheetProps {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  /**
   * Si la hoja entra deslizando o aparece puesta. **Por defecto entra.**
   *
   * Este primitivo no tenía ninguna entrada: `if (!abierto) return null` y la hoja
   * se materializaba en un fotograma, atenuador incluido. Lo consumen once sitios y
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

export function Sheet({ abierto, titulo, onCerrar, children, animar = true }: SheetProps) {
  if (!abierto) return null
  return (
    // El `z-50` que había aquí no decía nada: era un número más alto que el resto
    // y ya. Ahora el atenuador y la hoja viven en capas con nombre, y se ve de un
    // vistazo que la hoja va por encima de su propio atenuador y los dos por
    // encima de la barra inferior.
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 'var(--z-hoja)' }}
      role="dialog"
      aria-label={titulo}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className={`absolute inset-0 bg-black/60 ${animar ? 'scrim-entra' : ''}`}
        style={{ zIndex: 'var(--z-scrim)' }}
      />
      <div
        className={`relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-linea bg-surface-1 p-5 pb-8 ${
          animar ? 'subir-hoja' : ''
        }`}
        style={{ zIndex: 'var(--z-hoja)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-3" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-texto">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar panel"
            className="h-9 w-9 rounded-full border border-linea bg-surface-2 text-tenue"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
