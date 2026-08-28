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
    <section className="escena-prof rounded-tarjeta border border-ink-500 bg-ink-800 px-4 py-3.5">
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
            // Las semanas que faltan se HUNDEN y las hechas se quedan en el plano.
            // Es el mismo argumento que el carril de una barra: lo que todavía no
            // está es materia que falta. Y dice el estado con volumen además de con
            // color, que es lo que la marca pide — nunca con un semáforo.
            className={`h-1 flex-1 rounded-full ${hecha ? 'bg-accion' : 'bg-ink-500'}`}
            style={{ transform: `translateZ(var(${hecha ? '--prof-plano' : '--prof-hueco'}))` }}
          />
        ))}
      </div>

      {sesion ? (
        // EL ÚNICO `--prof-sujeto` DE TODA LA RUTA, y va aquí por eliminación: la
        // escala lo define como «despegado, UNO por escena — si hay dos, la escena ha
        // dejado de decir dónde mirar». En esta pantalla la persona viene a una sola
        // cosa, empezar la sesión de hoy; todo lo demás es contexto de esa decisión.
        //
        // Va en un envoltorio y no en el `Link` porque el `Link` lleva `.press`, que
        // ya escribe `transform`. Apilarlos deja que gane la última regla y la
        // profundidad o el acuse del toque desaparecerían sin ponerse nada en rojo.
        // Y el sentido de la marcha importa: +40 está POR ENCIMA del plano, así que
        // la diana de 44 px crece en vez de encoger.
        <div style={{ transform: 'translateZ(var(--prof-sujeto))' }}>
          <Link
            to={`/entrenar/sesion/${sesion.id}`}
            // Entrar a la sesión es moverse dentro del mismo gimnasio, no cambiar de
            // documento. React Router hace el resto con la View Transitions API, y
            // donde no esté soportada navega igual, sin transición.
            viewTransition
            className="press mt-3.5 flex items-center justify-center rounded-xl bg-accion py-3.5 text-center font-display text-sm text-white"
            style={{ boxShadow: 'var(--glow-accion), var(--sombra-alzado)' }}
          >
            {textoCta(sesion)} · {sesion.nombre}
          </Link>
        </div>
      ) : (
        <p className="mt-3.5 rounded-xl border border-ink-500 bg-ink-700 py-3 text-center text-sm font-bold text-silver-400">
          Sin sesión pendiente esta semana
        </p>
      )}
    </section>
  )
}
