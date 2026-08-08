import type { ReactNode } from 'react'

/**
 * La cabecera de una pantalla del asesorado.
 *
 * POR QUÉ `<h2>` Y NO `<h1>`. El `<h1>` de cada página es el del `TopBar`
 * (`layouts.tsx`), que anuncia en qué pestaña está la persona. Una pantalla que
 * emita el suyo deja dos títulos de nivel 1 en el mismo documento, y un lector
 * de pantalla los lee como dos comienzos distintos.
 *
 * POR QUÉ UNA SOLA FORMA. La etiqueta pequeña llegó a tener nueve variantes de
 * sí misma —`text-[10px]` o `[11px]`, `tracking` entre `0.12em` y `0.18em`— y el
 * título tres escalas. Ninguna diferencia significaba nada; eran copias que se
 * fueron separando. Aquí hay una y se usa tal cual.
 *
 * Se queda en `texto`/`tenue`, que siguen el tema claro/oscuro, y no en
 * `silver-*`, que está fijo en `:root`. Las pantallas oscuras siempre —Entrenar,
 * Progreso— lo son por decisión de diseño y no pasan por aquí.
 */
interface CabeceraPantallaProps {
  /** La línea pequeña en mayúsculas, sobre el título. */
  etiqueta?: string
  titulo: string
  /** Línea bajo el título: unas kcal, una explicación de una frase. */
  pie?: ReactNode
  /** Botones o enlaces, arriba a la derecha. */
  acciones?: ReactNode
  /** Si viene, se pinta el botón de volver a la izquierda. */
  alVolver?: () => void
  /** Qué anuncia el botón de volver. Concreto: «Volver» a secas no dice adónde. */
  etiquetaVolver?: string
  /**
   * Para títulos que salen de `Intl` en minúscula, como una fecha larga.
   * Ojo: `capitalize` de Tailwind sube la inicial de CADA palabra.
   */
  capitalizar?: boolean
  /**
   * Para el ritmo de entrada (`entrada entrada-1`) en las pantallas que lo
   * usan. No va dentro porque las hojas y los detalles no lo llevan: ya animan
   * al abrirse, y encadenar las dos animaciones se ve como un salto.
   */
  className?: string
}

export function CabeceraPantalla({
  etiqueta,
  titulo,
  pie,
  acciones,
  alVolver,
  etiquetaVolver = 'Volver',
  capitalizar = false,
  className = '',
}: CabeceraPantallaProps) {
  return (
    <header className={`flex items-start gap-3 ${className}`}>
      {alVolver && (
        <button
          type="button"
          onClick={alVolver}
          aria-label={etiquetaVolver}
          className="press mt-0.5 h-9 w-9 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
        >
          ←
        </button>
      )}

      {/* `min-w-0` deja que el título parta en varias líneas en vez de empujar
          las acciones fuera de la pantalla. */}
      <div className="min-w-0 flex-1">
        {etiqueta && (
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tenue">{etiqueta}</p>
        )}
        <h2
          className={`mt-1 font-display text-3xl leading-[1.05] text-texto ${
            capitalizar ? 'capitalize' : ''
          }`}
        >
          {titulo}
        </h2>
        {pie && <div className="mt-1.5 text-sm text-tenue">{pie}</div>}
      </div>

      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </header>
  )
}
