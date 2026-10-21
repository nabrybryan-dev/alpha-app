import type { AvisoPagoVisible } from '../../domain/avisoPago'

interface Props {
  /** Lo que devuelve `avisoPagoVisible`; sin aviso válido no se pinta nada. */
  aviso: AvisoPagoVisible | undefined
}

/**
 * Tarjeta de mensualidad vencida, arriba de «Hoy» (Bryan, 21-oct-2026). Va ENCIMA del plan,
 * en el flujo normal: no lo tapa ni se queda fija. El botón es un enlace de verdad
 * (`.boton-pago-3d` en `tokens.css`): abre el pago en pestaña nueva, con foco visible, y
 * se lee como «Pagar mi mensualidad, enlace, se abre en una pestaña nueva».
 */
export function AvisoPago({ aviso }: Props) {
  if (!aviso) return null
  return (
    <section
      aria-label="Aviso de mensualidad"
      className="entrada entrada-1 rounded-bloque border border-rojo bg-surface-1 p-4 shadow-sm"
    >
      <p className="text-sm leading-snug text-texto">{aviso.texto}</p>
      <div className="mt-4 flex justify-center pb-2">
        <a
          href={aviso.enlace}
          target="_blank"
          rel="noopener noreferrer"
          className="boton-pago-3d text-base"
        >
          PAGAR MI MENSUALIDAD
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      </div>
    </section>
  )
}
