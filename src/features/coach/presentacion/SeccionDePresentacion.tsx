import { useId, type ReactNode } from 'react'
import { Revelar } from '../../../components/ui/Revelar'

interface Props {
  /** El orden de la sección: escalona su entrada. */
  indice: number
  titulo: string
  /** Una frase que dice de qué va, para quien mira la pantalla sin que nadie se lo cuente. */
  subtitulo?: string
  children: ReactNode
}

/**
 * El marco de cada sección de la presentación: marca roja, título grande y la
 * entrada al aparecer. La entrada es `Revelar` (la de siempre en la app: IntersectionObserver
 * una sola vez, y sin movimiento si se pidió menos); aquí solo se escalona con el índice.
 */
export function SeccionDePresentacion({ indice, titulo, subtitulo, children }: Props) {
  const id = useId()
  return (
    <Revelar retrasoMs={Math.min(indice, 3) * 90}>
      <section aria-labelledby={id} className="rounded-bloque border border-linea bg-surface-1 p-4 sm:p-5">
        {/* Sin número de sección a propósito: el bloque reservado de velocidad y técnica no
            puede llevar ni una cifra, ni siquiera un «05». */}
        <span className="block h-1 w-8 rounded-full bg-rojo" aria-hidden="true" />
        <h3 id={id} className="font-display mt-2 text-[22px] leading-tight text-texto">
          {titulo}
        </h3>
        {subtitulo && <p className="mt-1 text-[13px] leading-snug text-tenue">{subtitulo}</p>}
        <div className="mt-4">{children}</div>
      </section>
    </Revelar>
  )
}
