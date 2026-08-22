import type { ReactNode } from 'react'

interface SheetProps {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

export function Sheet({ abierto, titulo, onCerrar, children }: SheetProps) {
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
        className="absolute inset-0 bg-black/60"
        style={{ zIndex: 'var(--z-scrim)' }}
      />
      <div
        className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-linea bg-surface-1 p-5 pb-8"
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
