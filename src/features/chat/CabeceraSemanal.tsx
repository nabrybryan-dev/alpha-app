import { useEffect, useRef, useState, type ReactNode } from 'react'
import { enlaceDeCabecera, type Cabecera } from './enlaceDeCabecera'

interface CabeceraSemanalProps {
  /**
   * De dónde sale el vídeo. Se inyecta para poder cambiarlo sin tocar esta
   * pantalla — ver `enlaceDeCabecera.ts`.
   */
  traerEnlace?: () => Promise<Cabecera | null>
  /** El hueco de la tarjeta con los números de la persona, que llega después. */
  children?: ReactNode
}

/**
 * El vídeo de la revisión semanal, fijo encima de la conversación, y debajo el
 * hueco de la tarjeta.
 *
 * El vídeo es una CABECERA: se graba una vez y sirve todas las semanas, porque
 * no dice ni un número ni un nombre. Lo que cambia cada semana es la tarjeta de
 * abajo. Ver `docs/specs/2026-09-10-revision-semanal-en-video.md`.
 */
export function CabeceraSemanal({ traerEnlace = enlaceDeCabecera, children }: CabeceraSemanalProps) {
  const [cabecera, setCabecera] = useState<Cabecera | null>(null)
  const [cargando, setCargando] = useState(true)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    let vigente = true
    // El «buscando» se siembra en el propio `useState` y no aquí: poner estado
    // dentro del cuerpo de un efecto es error de linter en este repo, y con
    // razón — encadena renders. Se paga con que un cambio de origen ya montado
    // no vuelve a mostrar el «buscando», y eso hoy no pasa nunca.
    //
    // Si el enlace no llega, la cabecera se queda con su mensaje honesto: la
    // conversación de abajo no se puede quedar bloqueada por un vídeo.
    traerEnlace()
      .then((valor) => {
        if (vigente && montado.current) setCabecera(valor)
      })
      .catch(() => {
        if (vigente && montado.current) setCabecera(null)
      })
      .finally(() => {
        if (vigente && montado.current) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [traerEnlace])

  return (
    <section
      role="region"
      aria-label="Tu revisión de la semana"
      className="entrada entrada-1 flex flex-col gap-2"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-tenue">
        <span className="h-1.5 w-1.5 rounded-full bg-rojo" aria-hidden="true" />
        Tu revisión de la semana
      </p>

      <div className="overflow-hidden rounded-2xl border border-linea bg-surface-1">
        {cabecera ? (
          <video
            src={cabecera.url}
            controls
            playsInline
            preload="metadata"
            aria-label="Vídeo de tu revisión semanal"
            className="block aspect-[9/16] max-h-[42vh] w-full bg-black object-contain"
          />
        ) : (
          <p className="px-4 py-6 text-center text-sm leading-relaxed text-tenue">
            {cargando ? 'Buscando tu revisión…' : 'Tu revisión en vídeo llega el domingo.'}
          </p>
        )}
      </div>

      {children}
    </section>
  )
}
