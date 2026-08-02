import { Link } from 'react-router-dom'
import type { BloqueEnCurso as Bloque } from '../../../domain/rutaEntrenamiento'

interface Props {
  bloque: Bloque
  /** Sesión a la que lleva el CTA. Sin ella no hay nada que empezar. */
  sesion?: { id: string; nombre: string; empezada: boolean; esDeHoy: boolean }
}

function textoCta(sesion: { empezada: boolean; esDeHoy: boolean }): string {
  if (sesion.empezada) return 'Continuar'
  return sesion.esDeHoy ? 'Sesión de hoy' : 'Siguiente sesión'
}

export function BloqueEnCurso({ bloque, sesion }: Props) {
  const segmentos = Array.from({ length: bloque.semanasTotales }, (_, i) => i < bloque.semana)

  return (
    <section className="rounded-tarjeta border border-ink-500 bg-ink-800 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-accion">
            Bloque en curso
          </h3>
          <p className="mt-1.5 text-[15px] font-bold text-silver-100">{bloque.nombre}</p>
          <p className="mt-1 text-xs text-silver-400">{bloque.detalle}</p>
        </div>
        <span className="cifras shrink-0 rounded-full border border-ink-400 px-2.5 py-1 text-xs font-bold text-silver-300">
          {bloque.semana}/{bloque.semanasTotales}
        </span>
      </div>

      <div className="mt-3 flex gap-[5px]" aria-hidden="true">
        {segmentos.map((hecha, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${hecha ? 'bg-accion' : 'bg-ink-500'}`}
          />
        ))}
      </div>

      {sesion ? (
        <Link
          to={`/entrenar/sesion/${sesion.id}`}
          className="press mt-3.5 flex items-center justify-center rounded-xl bg-accion py-3.5 text-center font-display text-sm text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          {textoCta(sesion)} · {sesion.nombre}
        </Link>
      ) : (
        <p className="mt-3.5 rounded-xl border border-ink-500 bg-ink-700 py-3 text-center text-sm font-bold text-silver-400">
          Sin sesión pendiente esta semana
        </p>
      )}
    </section>
  )
}
