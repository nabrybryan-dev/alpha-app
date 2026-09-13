import { Link } from 'react-router-dom'
import { comoTextoPlano } from '../../lib/negritasFicha'

interface PreguntaDelCoachProps {
  texto: string
  nombreCoach: string
}

/**
 * La pregunta pendiente del coach, debajo del vídeo de la revisión semanal.
 *
 * Decisión de Bryan (2026-09-12): se ve sin entrar al chat, entera y no recortada. Qué
 * mensaje cuenta como pendiente lo decide `domain/preguntaDelCoach.ts`; esta tarjeta
 * solo lo pinta, y desaparece sola cuando la persona contesta.
 *
 * «Responder» es un enlace de verdad al chat, como en `BarraCoach`: la respuesta vive en
 * el hilo, no en un campo paralelo que luego haya que juntar.
 */
export function PreguntaDelCoach({ texto, nombreCoach }: PreguntaDelCoachProps) {
  return (
    <section
      aria-label="Pregunta de tu coach"
      className="rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-tenue">
        <span className="h-1.5 w-1.5 rounded-full bg-rojo" aria-hidden="true" />
        {nombreCoach} te pregunta
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-texto">{comoTextoPlano(texto)}</p>
      <Link
        to="/chat"
        className="press mt-3 inline-flex items-center rounded-full bg-accion px-4 py-1.5 text-xs font-bold text-white"
      >
        Responder
      </Link>
    </section>
  )
}
